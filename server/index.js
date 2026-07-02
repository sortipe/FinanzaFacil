require('dotenv').config();
const express = require('express');
const cors = require('cors');
const SunatEngine = require('./sunat-engine');

const app = express();
app.use(cors());
app.use(express.json());

// Logger Universal
app.use((req, res, next) => {
    const fs = require('fs');
    const log = `[${new Date().toISOString()}] ${req.method} ${req.url}\n`;
    fs.appendFileSync('requests.log', log);
    console.log(log.trim());
    next();
});

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
        const fileName = `${currentConfig.ruc}-01-${invoiceData.id}`;
        console.log(`>>> ENVIANDO A SUNAT (${currentConfig.env}): ${fileName}`);
        const response = await engine.sendToSunat(fileName, signedXml, currentConfig);
        console.log('>>> RESPUESTA SUNAT:', response);
        
        // Extraer CDR del SOAP si existe
        let cdrBase64 = null;
        if (response && response.includes('<applicationResponse>')) {
            cdrBase64 = response.split('<applicationResponse>')[1].split('</applicationResponse>')[0];
        }

        // Detectar si hubo un error en el SOAP (Fault)
        const isFault = response && (response.includes('<soap-env:Fault>') || response.includes('<soap:Fault>'));
        
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
            cdrBase64: cdrBase64
        });
    } catch (error) {
        const fs = require('fs');
        console.error('--- ERROR EN PROCESO SUNAT ---');
        const sunatDetail = error.response?.data || error.message;
        console.error('Detalle SUNAT:', sunatDetail);
        fs.appendFileSync('error_sunat.log', `[${new Date().toISOString()}] ${error.stack}\nDetalle SUNAT: ${sunatDetail}\n\n`);
        res.status(500).json({
            success: false,
            error: 'Error interno en el proceso de SUNAT',
            detail: sunatDetail
        });
    }
});


// Atrapatodo de errores
app.use((err, req, res, next) => {
    console.error('--- ERROR GLOBAL DETECTADO ---');
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Servidor de Facturación SUNAT corriendo en http://localhost:${PORT}`);
});

// Latido para mantener el proceso vivo en algunos entornos
setInterval(() => {}, 1000 * 60 * 60);
