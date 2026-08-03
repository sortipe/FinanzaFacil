require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const SunatEngine = require('./sunat-engine');
const { initSchema } = require('./db-schema');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize database schema and seed on startup
initSchema().then(() => {
  const { seed } = require('./seed');
  return seed();
}).catch(err => console.error('DB init error:', err));

// Logger Universal
app.use((req, res, next) => {
    const fs = require('fs');
    const log = `[${new Date().toISOString()}] ${req.method} ${req.url}\n`;
    fs.appendFileSync('requests.log', log);
    console.log(log.trim());
    next();
});

// API Routes (CRUD)
const apiRoutes = require('./api-routes');
app.use('/api', apiRoutes);

const config = {
    ruc: process.env.SUNAT_RUC,
    user: process.env.SUNAT_USER,
    pass: process.env.SUNAT_PASS,
    env: process.env.SUNAT_ENV,
    certPath: process.env.CERT_PATH,
    certPass: process.env.CERT_PASS
};


const engine = new SunatEngine(config);

// Endpoint para verificar si el servidor está vivo
app.get('/status', (req, res) => res.json({ status: 'ok' }));

// Endpoint para verificar credenciales SUNAT
app.post('/verificar-conexion', async (req, res) => {
    console.log('>>> RECIBIDA PETICIÓN DE VERIFICACIÓN');
    console.log('Body:', JSON.stringify(req.body, null, 2));
    try {
        const { credentials } = req.body;
        const testEngine = new SunatEngine(credentials);
        

        // 1. Probar firmado (Valida Certificado y Clave)
        if (!credentials.certBase64 && !credentials.certPath) {
            throw new Error('Debes subir un certificado digital (.pfx) antes de verificar');
        }
        if (!credentials.certPass) {
            throw new Error('Debes ingresar la contraseña del certificado');
        }
        const testXml = `
            <Invoice xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
                <ext:UBLExtensions>
                    <ext:UBLExtension>
                        <ext:ExtensionContent>[SIGNATURE_HERE]</ext:ExtensionContent>
                    </ext:UBLExtension>
                </ext:UBLExtensions>
                <Test>Verificacion</Test>
            </Invoice>
        `;
        await testEngine.signXml(testXml, credentials.certBase64 || credentials.certPath, credentials.certPass);
        
        // 2. Probar envío a SUNAT (Valida RUC, Usuario y Clave SOL)
        // Usamos un nombre de archivo aleatorio para evitar el error de "Documento igual en proceso"
        const testId = `TEST-${Math.floor(Math.random() * 1000000)}`;
        const response = await testEngine.sendToSunat(testId, '<Test>Sign</Test>', credentials);

        // Detectar Fault SOAP en la respuesta (HTTP 200 no implica credenciales válidas)
        const isFault = response && (response.includes('<soap-env:Fault') || response.includes('<soap:Fault'));
        if (isFault) {
            const faultString = response.split('<faultstring>')[1]?.split('</faultstring>')[0] || 'SUNAT rechazó las credenciales';
            return res.status(400).json({
                success: false,
                error: faultString,
                sunatResponse: response
            });
        }

        res.json({
            success: true,
            message: 'Conexión exitosa con SUNAT'
        });
    } catch (error) {
        console.error('Error de verificación:', error.message);
        if (error.response) {
            console.error('Detalle SUNAT:', error.response.data);
        }
        res.status(400).json({
            success: false,
            error: error.response?.data || error.message
        });
    }
});


app.post('/emitir-factura', async (req, res) => {
    try {
        const { invoiceData, credentials } = req.body;
        console.log('--- NUEVA PETICIÓN DE EMISIÓN ---');
        console.log('Datos Recibidos:', JSON.stringify(invoiceData, null, 2));
        
        // Usamos las credenciales enviadas o las del .env por defecto
        const currentConfig = {
            ruc: credentials?.ruc || config.ruc,
            user: credentials?.user || config.user,
            pass: credentials?.pass || config.pass,
            env: credentials?.env || config.env,
            certData: credentials?.certBase64 || config.certPath,
            certPass: credentials?.certPass || config.certPass
        };

        const engine = new SunatEngine(currentConfig);

        // 1. Generar XML
        const xml = engine.buildInvoiceXml(invoiceData);
        console.log('XML Generado (sin firma):', xml.substring(0, 500) + '...');
        
        // 2. Firmar XML
        const signedXml = await engine.signXml(xml, currentConfig.certData, currentConfig.certPass);
        console.log('XML Firmado (primeros 500 caracteres):', signedXml.substring(0, 500) + '...');
        
        // 3. Enviar a SUNAT
        const tipoDoc = invoiceData.id?.startsWith('B') ? '03' : '01';
        const fileName = `${currentConfig.ruc}-${tipoDoc}-${invoiceData.id}`;
        console.log(`>>> ENVIANDO A SUNAT (${currentConfig.env}): ${fileName}`);
        const response = await engine.sendToSunat(fileName, signedXml, currentConfig);
        console.log('>>> RESPUESTA SUNAT:', response);
        
        // Extraer CDR del SOAP si existe
        let cdrBase64 = null;
        let cdrCode = null;
        let cdrDesc = null;
        if (response && response.includes('<applicationResponse>')) {
            cdrBase64 = response.split('<applicationResponse>')[1].split('</applicationResponse>')[0];
            // Decodificar CDR (ZIP con XML)
            try {
                const zipBuffer = Buffer.from(cdrBase64, 'base64');
                const AdmZip = require('adm-zip');
                const zip = new AdmZip(zipBuffer);
                const entries = zip.getEntries();
                const cdrXml = entries[0]?.getData().toString('utf-8');
                if (cdrXml) {
                    const codeMatch = cdrXml.match(/<cbc:ResponseCode[^>]*>([^<]+)<\/cbc:ResponseCode>/);
                    const descMatch = cdrXml.match(/<cbc:Description[^>]*>([^<]+)<\/cbc:Description>/);
                    cdrCode = codeMatch?.[1] || null;
                    cdrDesc = descMatch?.[1] || null;
                    console.log('>>> CDR ResponseCode:', cdrCode);
                    console.log('>>> CDR Description:', cdrDesc);
                }
            } catch (e) {
                console.log('>>> Error decodificando CDR:', e.message);
            }
        }

        // Detectar si hubo un error en el SOAP (Fault)
        const isFault = response && (response.includes('<soap-env:Fault') || response.includes('<soap:Fault'));
        
        if (isFault) {
            const faultString = response.split('<faultstring>')[1]?.split('</faultstring>')[0] || 'Error desconocido en SUNAT';
            return res.status(400).json({
                success: false,
                error: faultString,
                sunatResponse: response
            });
        }

        res.json({
            success: true,
            message: 'Factura enviada a SUNAT',
            sunatResponse: response,
            xmlContent: signedXml,
            cdrBase64: cdrBase64,
            cdrCode: cdrCode,
            cdrDesc: cdrDesc
        });
    } catch (error) {
        const fs = require('fs');
        console.error('--- ERROR EN PROCESO SUNAT ---');
        const sunatDetail = error.response?.data || error.message;
        console.error('Detalle SUNAT:', sunatDetail);
        fs.appendFileSync('error_sunat.log', `[${new Date().toISOString()}] ${error.stack}\nDetalle SUNAT: ${sunatDetail}\n\n`);
        // Extraer el faultstring real de SUNAT si viene en la respuesta
        const faultMatch = typeof sunatDetail === 'string' && sunatDetail.match(/<faultstring>([^<]+)<\/faultstring>/);
        const userError = faultMatch ? faultMatch[1] : 'Error en comunicación con SUNAT';
        res.status(500).json({
            success: false,
            error: userError,
            detail: sunatDetail
        });
    }
});

app.post('/consultar-cpe', async (req, res) => {
    try {
        const { ruc, tipo, serie, numero, credentials } = req.body;
        const currentConfig = {
            ruc: credentials?.ruc || config.ruc,
            user: credentials?.user || config.user,
            pass: credentials?.pass || config.pass,
            env: credentials?.env || config.env,
            certData: credentials?.certBase64 || config.certPath,
            certPass: credentials?.certPass || config.certPass
        };
        const engine = new SunatEngine(currentConfig);
        const result = await engine.consultarCPE(ruc, tipo, serie, numero, currentConfig);
        res.json(result);
    } catch (error) {
        const sunatDetail = error.response?.data || error.message;
        const faultMatch = typeof sunatDetail === 'string' && sunatDetail.match(/<faultstring>([^<]+)<\/faultstring>/);
        const isNotFound = typeof sunatDetail === 'string' && (sunatDetail.includes('404') || sunatDetail.includes('Not Found'));
        res.status(isNotFound ? 200 : 500).json({
            success: isNotFound,
            statusCode: isNotFound ? 'N/A' : null,
            description: isNotFound ? 'No encontrado en SUNAT (puede tardar unos minutos)' : (faultMatch ? faultMatch[1] : 'Error al consultar CPE'),
            raw: sunatDetail
        });
    }
});

// --- Emitir Nota de Crédito / Débito ---
app.post('/emitir-nota', async (req, res) => {
    try {
        const { noteData, credentials, noteType } = req.body;
        const currentConfig = {
            ruc: credentials?.ruc || config.ruc,
            user: credentials?.user || config.user,
            pass: credentials?.pass || config.pass,
            env: credentials?.env || config.env,
            certData: credentials?.certBase64 || config.certPath,
            certPass: credentials?.certPass || config.certPass
        };
        const engine = new SunatEngine(currentConfig);

        // Build XML según tipo
        const isCredit = noteType === 'nota_credito';
        const xml = isCredit
            ? engine.buildCreditNoteXml(noteData)
            : engine.buildDebitNoteXml(noteData);

        // Sign
        const rootElement = isCredit ? 'CreditNote' : 'DebitNote';
        const signedXml = await engine.signXml(xml, currentConfig.certData, currentConfig.certPass, rootElement);

        // Serie for NC: FC01 (factura crédito) / BC01 (boleta crédito)
        // Serie for ND: FD01 (factura débito) / BD01 (boleta débito)
        const tipoDoc = isCredit ? '07' : '08';
        const fileName = `${currentConfig.ruc}-${tipoDoc}-${noteData.id}`;
        console.log(`>>> ENVIANDO NOTA A SUNAT (${currentConfig.env}): ${fileName}`);

        // Send to SUNAT
        const response = await engine.sendToSunat(fileName, signedXml, currentConfig);
        const isAccepted = !response.includes('<soap-env:Fault') && !response.includes('<soap:Fault');

        // Detectar Fault y extraer el faultstring real de SUNAT
        const isFault = response && (response.includes('<soap-env:Fault') || response.includes('<soap:Fault'));
        if (isFault) {
            const faultString = response.split('<faultstring>')[1]?.split('</faultstring>')[0] || 'Error desconocido en SUNAT';
            return res.status(400).json({
                success: false,
                error: faultString,
                sunatResponse: response
            });
        }

        // Extract CDR
        const cdrMatch = response.match(/<applicationResponse>([\s\S]*?)<\/applicationResponse>/);
        let cdrBase64 = null;
        if (cdrMatch) {
            cdrBase64 = cdrMatch[1].trim();
        }

        res.json({
            success: isAccepted,
            xmlContent: signedXml,
            cdrBase64,
            sunatStatus: isAccepted ? 'SENT' : 'REJECTED',
            raw: response
        });
    } catch (error) {
        const sunatDetail = error.response?.data || error.message;
        const faultMatch = typeof sunatDetail === 'string' && sunatDetail.match(/<faultstring>([^<]+)<\/faultstring>/);
        res.status(500).json({
            success: false,
            error: faultMatch ? faultMatch[1] : 'Error al emitir nota',
            raw: sunatDetail
        });
    }
});

// Atrapatodo de errores
app.use((err, req, res, next) => {
    console.error('--- ERROR GLOBAL DETECTADO ---');
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
});

// Endpoint para consultar DNI/RUC a través de SUNAT (evita CORS)
app.get('/consultar-dni', async (req, res) => {
    try {
        const { dni } = req.query;
        if (!dni || dni.length !== 8) return res.status(400).json({ success: false, error: 'DNI inválido' });
        const axios = require('axios');
        const response = await axios.get(`https://ww1.sunat.gob.pe/ol-ti-itfisdenreg/itfisdenreg.htm?accion=obtenerDatosDni&numDocumento=${dni}`, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 'Referer': 'https://ww1.sunat.gob.pe/' } });
        const data = response.data;
        const item = data.lista?.[0];
        if (data.message === 'success' && item?.nombresapellidos) {
            const parts = item.nombresapellidos.split(',');
            const name = parts.length > 1 ? `${parts[1].trim()} ${parts[0].trim()}` : parts[0].trim();
            return res.json({ success: true, name });
        }
        res.json({ success: false, error: 'No se encontró el DNI' });
    } catch (e) {
        res.status(500).json({ success: false, error: 'Error de conexión con SUNAT' });
    }
});

app.get('/consultar-ruc', async (req, res) => {
    try {
        const { ruc } = req.query;
        if (!ruc || ruc.length !== 11) return res.status(400).json({ success: false, error: 'RUC inválido' });
        const axios = require('axios');
        const response = await axios.get(`https://ww1.sunat.gob.pe/ol-ti-itfisdenreg/itfisdenreg.htm?accion=obtenerDatosRuc&nroRuc=${ruc}`, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 'Referer': 'https://ww1.sunat.gob.pe/' } });
        const data = response.data;
        const item = data.lista?.[0];
        if (data.message === 'success' && item?.apenomdenunciado) {
            return res.json({ success: true, razonSocial: item.apenomdenunciado.trim(), address: (item.direstablecimiento || '').trim() });
        }
        res.json({ success: false, error: 'No se encontró el RUC' });
    } catch (e) {
        res.status(500).json({ success: false, error: 'Error de conexión con SUNAT' });
    }
});

// Endpoint para analizar recibo con Gemini IA
app.post('/analizar-recibo', async (req, res) => {
    const { base64Image, mimeType } = req.body;
    if (!base64Image || !mimeType) {
        return res.status(400).json({ success: false, error: 'Faltan base64Image o mimeType' });
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(400).json({ success: false, error: 'GEMINI_API_KEY no configurada en el servidor' });
    }
    try {
        const prompt = "Analiza este recibo peruano (Factura o Boleta). Extrae: 1. Total (número), 2. Fecha (YYYY-MM-DD), 3. Nombre del comercio (Razón Social), 4. RUC del emisor (11 dígitos), 5. Número de comprobante (serie y número, ej: F001-000123), 6. Subtotal (base imponible), 7. IGV (18%), 8. Categoría (Alimentación, Transporte, Servicios, Ocio, Salud, Otros).";
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
                contents: [{
                    parts: [
                        { inlineData: { mimeType, data: base64Image } },
                        { text: prompt }
                    ]
                }],
                generationConfig: {
                    responseMimeType: "application/json"
                }
            },
            { timeout: 30000 }
        );
        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
            return res.json({ success: true, data: JSON.parse(text) });
        }
        res.status(500).json({ success: false, error: 'Respuesta inesperada de Gemini', raw: response.data });
    } catch (e) {
        const msg = e.response?.data?.error?.message || e.message || 'Error desconocido';
        console.error('Gemini error:', msg);
        res.status(500).json({ success: false, error: msg });
    }
});

// Endpoint para enviar correo con contraseña generada
const nodemailer = require('nodemailer');
app.post('/api/send-welcome-email', async (req, res) => {
    const { email, name, password } = req.body;
    if (!email || !name || !password) {
        return res.status(400).json({ success: false, error: 'Faltan campos requeridos: email, name, password' });
    }
    // En desarrollo siempre se loguea la contraseña como respaldo
    console.log(`\n========================================`);
    console.log(`📧 CORREO DE BIENVENIDA (simulado)`);
    console.log(`   Para: ${email}`);
    console.log(`   Nombre: ${name}`);
    console.log(`   Contraseña temporal: ${password}`);
    console.log(`========================================\n`);
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.EMAIL_PORT || '587'),
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
        await transporter.sendMail({
            from: `"FinanzaFacil" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Bienvenido a FinanzaFacil - Tu contraseña temporal',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px;">
                    <div style="text-align: center; margin-bottom: 24px;">
                        <h1 style="color: #7C3AED; font-size: 24px;">FinanzaFacil</h1>
                    </div>
                    <h2 style="color: #333;">¡Bienvenido, ${name}!</h2>
                    <p style="color: #555; font-size: 14px; line-height: 1.6;">
                        Tu cuenta ha sido creada exitosamente. Para acceder, utiliza la siguiente contraseña temporal:
                    </p>
                    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; text-align: center; margin: 20px 0;">
                        <code style="font-size: 24px; font-weight: bold; color: #7C3AED; letter-spacing: 4px;">${password}</code>
                    </div>
                    <p style="color: #e74c3c; font-size: 13px; font-weight: bold;">
                        ⚠ Esta es una contraseña temporal. Debes cambiarla al iniciar sesión por primera vez.
                    </p>
                    <p style="color: #555; font-size: 13px; line-height: 1.6;">
                        Por seguridad, no compartas esta contraseña con nadie.
                    </p>
                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />
                    <p style="color: #999; font-size: 11px; text-align: center;">
                        FinanzaFacil - Tu plataforma de finanzas inteligentes
                    </p>
                </div>
            `
        });
        console.log(`✅ Correo enviado exitosamente a ${email}`);
        res.json({ success: true, message: 'Correo enviado correctamente' });
    } catch (err) {
        console.log(`⚠ No se pudo enviar el correo (la contraseña se logueó arriba): ${err.message}`);
        res.json({ success: true, warning: err.message, message: 'Contraseña disponible en consola del servidor' });
    }
});

// --- Emitir Recibo por Honorarios vía scraper web (Portal SOL) ---
app.post('/scrape/rh', async (req, res) => {
    try {
        const payload = req.body || {};
        console.log('[SUNAT] scrape/rh payload keys:', Object.keys(payload));
        const required = ['ruc', 'solUser', 'solPass', 'docNumber', 'nameOrRazon', 'concepto', 'montoNeto'];
        const missing = required.filter(key => !payload[key]);
        if (missing.length > 0) {
            return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });
        }

        const env = {
            ...process.env,
            SUNAT_NON_INTERACTIVE: 'true',
            SUNAT_RUC: String(payload.ruc || ''),
            SUNAT_USUARIO: String(payload.solUser || ''),
            SUNAT_CLAVE: String(payload.solPass || ''),
            SUNAT_DOC_TYPE: String(payload.docType || 'DNI'),
            SUNAT_DOC_NUMBER: String(payload.docNumber || ''),
            SUNAT_NOMBRE_RECEPTOR: String(payload.nameOrRazon || ''),
            SUNAT_TIPO_RENTA: String(payload.tipoRenta || '4'),
            SUNAT_CONCEPTO: String(payload.concepto || ''),
            SUNAT_MONEDA: String(payload.moneda || 'SOLES'),
            SUNAT_MONTO_NETO: String(payload.montoNeto || ''),
            SUNAT_RETENCION: String(payload.retencion || 'no'),
            SUNAT_HEADLESS: String(payload.headless ?? 'false'),
            SUNAT_STOP_BEFORE_EMIT: String(payload.stopBeforeEmit ?? 'true'),
        };

        const child = spawn('node', ['scripts/sunat/rxh-scraper.mjs'], {
            env,
            cwd: require('path').resolve(__dirname, '..'),
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: false,
            shell: false,
            windowsHide: true,
        });

        let stdoutLog = '';
        let stderrLog = '';

        if (child.stdout) {
            child.stdout.on('data', chunk => {
                const text = chunk.toString();
                stdoutLog += text;
                console.log(`[SUNAT] ${text}`);
            });
        }
        if (child.stderr) {
            child.stderr.on('data', chunk => {
                const text = chunk.toString();
                stderrLog += text;
                console.error(`[SUNAT] ${text}`);
            });
        }

        const exitInfo = await new Promise((resolve, reject) => {
            child.on('error', reject);
            child.on('exit', (code, signal) => resolve({ code, signal }));
        });

        const pdfMatch = stdoutLog.match(/PDF descargado:\s*(.+)/i);
        const xmlMatch = stdoutLog.match(/XML descargado:\s*(.+)/i);
        const pdfPath = pdfMatch ? pdfMatch[1].trim() : '';
        const xmlPath = xmlMatch ? xmlMatch[1].trim() : '';

        if (exitInfo.code === 0) {
            return res.json({ ok: true, pdfPath, xmlPath });
        }
        return res.status(500).json({
            ok: false,
            error: `Scraper failed with code ${exitInfo.code}`,
            pdfPath,
            xmlPath,
            stderr: stderrLog.trim(),
        });
    } catch (err) {
        console.error('[SUNAT] scrape/rh error:', err);
        return res.status(500).json({ error: err.message || 'Server error' });
    }
});

// Servir los documentos generados por los scrapers
app.use('/downloads', express.static(require('path').resolve(__dirname, '../downloads')));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Servidor de Facturación SUNAT corriendo en http://localhost:${PORT}`);
});

// Latido para mantener el proceso vivo en algunos entornos
setInterval(() => {}, 1000 * 60 * 60);
