require('dotenv').config();
const express = require('express');
const cors = require('cors');
const SunatEngine = require('./sunat-engine');

const app = express();
app.use(cors());
app.use(express.json());

// Logger Universal (Console only for Vercel)
app.use((req, res, next) => {
    const log = `[${new Date().toISOString()}] ${req.method} ${req.url}`;
    console.log(log);
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

// Endpoint para verificar si el servidor está vivo
app.get('/api/status', (req, res) => res.json({ status: 'ok', environment: 'vercel' }));

// Endpoint para verificar credenciales SUNAT
app.post('/api/verificar-conexion', async (req, res) => {
    try {
        const { credentials } = req.body;
        const testEngine = new SunatEngine(credentials);
        
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
        
        const testId = `TEST-${Math.floor(Math.random() * 1000000)}`;
        const response = await testEngine.sendToSunat(testId, '<Test>Sign</Test>', credentials);
        
        res.json({
            success: true,
            message: 'Conexión exitosa con SUNAT'
        });
    } catch (error) {
        console.error('Error de verificación:', error.message);
        res.status(400).json({
            success: false,
            error: error.response?.data || error.message
        });
    }
});

app.post('/api/emitir-factura', async (req, res) => {
    try {
        const { invoiceData, credentials } = req.body;
        
        const currentConfig = {
            ruc: credentials?.ruc || config.ruc,
            user: credentials?.user || config.user,
            pass: credentials?.pass || config.pass,
            env: credentials?.env || config.env,
            certData: credentials?.certBase64 || config.certPath,
            certPass: credentials?.certPass || config.certPass
        };

        const engine = new SunatEngine(currentConfig);

        const xml = engine.buildInvoiceXml(invoiceData);
        const signedXml = await engine.signXml(xml, currentConfig.certData, currentConfig.certPass);
        
        const tipoDoc = invoiceData.id?.startsWith('B') ? '03' : '01';
        const fileName = `${currentConfig.ruc}-${tipoDoc}-${invoiceData.id}`;
        const response = await engine.sendToSunat(fileName, signedXml, currentConfig);
        
        let cdrBase64 = null;
        if (response && response.includes('<applicationResponse>')) {
            cdrBase64 = response.split('<applicationResponse>')[1].split('</applicationResponse>')[0];
        }

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
        console.error('--- ERROR EN PROCESO SUNAT ---');
        const sunatDetail = error.response?.data || error.message;
        console.error('Detalle SUNAT:', sunatDetail);
        res.status(500).json({
            success: false,
            error: 'Error interno en el proceso de SUNAT',
            detail: sunatDetail
        });
    }
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('--- ERROR GLOBAL DETECTADO ---');
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
});

module.exports = app;
