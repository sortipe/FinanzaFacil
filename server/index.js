require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
process.on('uncaughtException', (err) => { console.error('=== UNCAUGHT EXCEPTION ===', err.stack || err); const fs = require('fs'); fs.appendFileSync('crash.log', `[${new Date().toISOString()}] UNCAUGHT: ${err.stack}\n\n`); });
process.on('unhandledRejection', (reason) => { console.error('=== UNHANDLED REJECTION ===', reason); const fs = require('fs'); fs.appendFileSync('crash.log', `[${new Date().toISOString()}] UNHANDLED: ${reason}\n\n`); });
const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const SunatEngine = require('./sunat-engine');
const { initSchema } = require('./db-schema');

const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

const { emitInvoiceDocument, emitNoteDocument } = require('./emitters');

const config = {
    ruc: process.env.SUNAT_RUC,
    user: process.env.SUNAT_USER,
    pass: process.env.SUNAT_PASS,
    env: process.env.SUNAT_ENV,
    certPath: process.env.CERT_PATH,
    certPass: process.env.CERT_PASS,
    codEstablecimiento: process.env.COD_ESTABLECIMIENTO || '0',
    codLocalAnexo: process.env.COD_LOCAL_ANEXO || '0',
    ubigeo: process.env.SUNAT_UBIGEO || '150101',
    department: process.env.SUNAT_DEPARTMENT || 'LIMA',
    district: process.env.SUNAT_DISTRICT || 'LIMA'
};

// Serie SUNAT válida: F001-F999 (factura/notas) o B001-B999 (boleta/notas). 3 dígitos.
const SERIE_SUNAT_REGEX = /^[FBETV][0-9]{3}$/;
const serieFromDocId = (id) => String(id || '').split('-')[0] || '';


const engine = new SunatEngine(config);

// Endpoint para verificar si el servidor está vivo
app.get('/status', (req, res) => res.json({ status: 'ok' }));

// Endpoint para verificar credenciales SUNAT
app.post('/verificar-conexion', async (req, res) => {
    console.log('>>> RECIBIDA PETICIÓN DE VERIFICACIÓN');
    console.log('Credenciales (ocultando cert y clave):', JSON.stringify({
        ruc: req.body?.credentials?.ruc,
        user: req.body?.credentials?.user,
        env: req.body?.credentials?.env,
        tieneCert: !!(req.body?.credentials?.certBase64 || req.body?.credentials?.certPath),
        certName: req.body?.credentials?.certName
    }));
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
        
        // 2. Validar RUC, Usuario y Clave SOL contra SUNAT (getStatus por ticket,
        //    no envía ningún documento ni nombre de archivo)
        const status = await testEngine.verificarCredenciales(credentials);

        // Fault SOAP = credenciales inválidas (usuario/clave/RUC); respuesta normal = conexión OK
        if (!status.success) {
            const faultString = status.faultstring || status.statusMessage || 'SUNAT rechazó las credenciales';
            console.log('>>> VERIFICACION FALLIDA SUNAT:', faultString);
            return res.status(400).json({
                success: false,
                error: `Credenciales SOL inválidas: ${faultString}`,
                sunatResponse: status.raw
            });
        }

        res.json({
            success: true,
            message: 'Conexión exitosa con SUNAT'
        });
    } catch (error) {
        console.error('Error de verificación:', error.message);
        let errorMsg = error.message;
        if (error.response?.data) {
            console.error('Detalle SUNAT:', error.response.data);
            if (typeof error.response.data === 'string') {
                const match = error.response.data.match(/<faultstring[^>]*>([^<]+)<\/faultstring>/);
                if (match) errorMsg = match[1];
                else if (error.response.data.includes('404 Not Found')) errorMsg = 'Servicio SUNAT no encontrado (404)';
            }
        }
        res.status(400).json({
            success: false,
            error: errorMsg,
            sunatResponse: error.response?.data
        });
    }
});


app.post('/emitir-factura', async (req, res) => {
    const r = await emitInvoiceDocument(req.body.invoiceData, req.body.credentials);
    res.status(r.status).json(r.body);
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
            certPass: credentials?.certPass || config.certPass,
            codEstablecimiento: credentials?.codEstablecimiento || config.codEstablecimiento || '0',
            codLocalAnexo: credentials?.codLocalAnexo || config.codLocalAnexo || '0'
        };
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
    const { noteData, credentials, noteType } = req.body;
    const r = await emitNoteDocument(noteType, noteData, credentials);
    res.status(r.status).json(r.body);
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
const { sendEmail } = require('./mailer');
app.post('/api/send-welcome-email', async (req, res) => {
    const { email, name, password } = req.body;
    if (!email || !name || !password) {
        return res.status(400).json({ success: false, error: 'Faltan campos requeridos: email, name, password' });
    }
    const baseUrl = process.env.APP_URL || 'https://finanzafacil.com';
    const loginUrl = `${baseUrl.replace(/\/$/, '')}/?email=${encodeURIComponent(email)}`;

    // En desarrollo siempre se loguea la contraseña como respaldo
    console.log(`\n========================================`);
    console.log(`📧 CORREO DE BIENVENIDA (simulado)`);
    console.log(`   Para: ${email}`);
    console.log(`   Nombre: ${name}`);
    console.log(`   Contraseña temporal: ${password}`);
    console.log(`   Link de Ingreso: ${loginUrl}`);
    console.log(`========================================\n`);
    try {
        const result = await sendEmail({
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
                    <div style="text-align: center; margin: 28px 0 16px 0;">
                        <a href="${loginUrl}" target="_blank" style="background-color: #7C3AED; color: #ffffff; padding: 14px 32px; font-size: 14px; font-weight: bold; text-decoration: none; border-radius: 12px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(124, 58, 237, 0.3);">
                            Ingresar a mi Cuenta
                        </a>
                    </div>
                    <p style="color: #6b7280; font-size: 12px; text-align: center;">
                        O copia este enlace en tu navegador:<br/>
                        <a href="${loginUrl}" style="color: #7C3AED; word-break: break-all;">${loginUrl}</a>
                    </p>
                    <p style="color: #e74c3c; font-size: 13px; font-weight: bold; margin-top: 20px;">
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
        if (result.sent) {
            console.log(`✅ Correo enviado exitosamente a ${email}`);
            res.json({ success: true, message: 'Correo enviado correctamente' });
        } else {
            console.log(`⚠ No se pudo enviar el correo (la contraseña se logueó arriba): ${result.warning}`);
            res.json({ success: true, warning: result.warning, message: 'Contraseña disponible en consola del servidor' });
        }
    } catch (err) {
        console.log(`⚠ No se pudo enviar el correo (la contraseña se logueó arriba): ${err.message}`);
        res.json({ success: true, warning: err.message, message: 'Contraseña disponible en consola del servidor' });
    }
});

// Endpoint para enviar correo con contraseña restablecida por administrador
app.post('/api/send-password-reset-email', async (req, res) => {
    const { email, name, password } = req.body;
    if (!email || !name || !password) {
        return res.status(400).json({ success: false, error: 'Faltan campos requeridos: email, name, password' });
    }
    const baseUrl = process.env.APP_URL || 'https://finanzafacil.com';
    const loginUrl = `${baseUrl.replace(/\/$/, '')}/?email=${encodeURIComponent(email)}`;

    console.log(`\n========================================`);
    console.log(`📧 CORREO DE RECUPERACIÓN (simulado)`);
    console.log(`   Para: ${email}`);
    console.log(`   Nombre: ${name}`);
    console.log(`   Nueva contraseña: ${password}`);
    console.log(`   Link de Ingreso: ${loginUrl}`);
    console.log(`========================================\n`);
    try {
        const result = await sendEmail({
            to: email,
            subject: 'Contraseña Restablecida - FinanzaFacil',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px;">
                    <div style="text-align: center; margin-bottom: 24px;">
                        <h1 style="color: #7C3AED; font-size: 24px;">FinanzaFacil</h1>
                    </div>
                    <h2 style="color: #333;">Hola ${name},</h2>
                    <p style="color: #555; font-size: 14px; line-height: 1.6;">
                        Un administrador ha restablecido tu contraseña de acceso. Para ingresar al sistema, utiliza la siguiente clave temporal:
                    </p>
                    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; text-align: center; margin: 20px 0;">
                        <code style="font-size: 24px; font-weight: bold; color: #7C3AED; letter-spacing: 4px;">${password}</code>
                    </div>
                    <div style="text-align: center; margin: 28px 0 16px 0;">
                        <a href="${loginUrl}" target="_blank" style="background-color: #7C3AED; color: #ffffff; padding: 14px 32px; font-size: 14px; font-weight: bold; text-decoration: none; border-radius: 12px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(124, 58, 237, 0.3);">
                            Ingresar a mi Cuenta
                        </a>
                    </div>
                    <p style="color: #6b7280; font-size: 12px; text-align: center;">
                        O copia este enlace en tu navegador:<br/>
                        <a href="${loginUrl}" style="color: #7C3AED; word-break: break-all;">${loginUrl}</a>
                    </p>
                    <p style="color: #e74c3c; font-size: 13px; font-weight: bold; margin-top: 20px;">
                        ⚠ Esta es una contraseña temporal. Debes cambiarla al iniciar sesión por primera vez.
                    </p>
                    <p style="color: #555; font-size: 13px; line-height: 1.6;">
                        Por seguridad, no compartas esta contraseña con nadie. Si no has solicitado este restablecimiento, contacta a soporte inmediatamente.
                    </p>
                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />
                    <p style="color: #999; font-size: 11px; text-align: center;">
                        FinanzaFacil - Tu plataforma de finanzas inteligentes
                    </p>
                </div>
            `
        });
        if (result.sent) {
            console.log(`✅ Correo de recuperación enviado exitosamente a ${email}`);
            res.json({ success: true, message: 'Correo enviado correctamente' });
        } else {
            console.log(`⚠ No se pudo enviar el correo (la contraseña se logueó arriba): ${result.warning}`);
            res.json({ success: true, warning: result.warning, message: 'Contraseña disponible en consola del servidor' });
        }
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

// Servir la aplicación frontend compilada (dist)
const distPath = require('path').resolve(__dirname, '../dist');
app.use(express.static(distPath));

// Fallback SPA para rutas del cliente (React Router / HashRouter) - Compatible con Express 5
app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api') || 
        req.path.startsWith('/status') || 
        req.path.startsWith('/verificar-conexion') || 
        req.path.startsWith('/emitir-') || 
        req.path.startsWith('/consultar-') || 
        req.path.startsWith('/analizar-recibo') || 
        req.path.startsWith('/scrape') || 
        req.path.startsWith('/downloads')) {
        return next();
    }
    const indexPath = require('path').resolve(distPath, 'index.html');
    const fs = require('fs');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Aplicación frontend no encontrada (dist/index.html)');
    }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Servidor de Facturación SUNAT corriendo en http://localhost:${PORT}`);
    // Motor de reintentos automáticos de pendientes SUNAT (100% servidor)
    require('./retry-worker').startRetryWorker();
});

// Latido para mantener el proceso vivo en algunos entornos
setInterval(() => {}, 1000 * 60 * 60);
