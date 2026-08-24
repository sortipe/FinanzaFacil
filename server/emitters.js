/**
 * emitters.js
 * Lógica central de emisión a SUNAT, compartida por:
 *  - Las rutas HTTP /emitir-factura y /emitir-nota (server/index.js)
 *  - El worker de reintentos automáticos (server/retry-worker.js)
 *
 * Cada función devuelve { status, body } para que las rutas HTTP respondan
 * exactamente igual que antes de la extracción.
 */

const SunatEngine = require('./sunat-engine');

const SERIE_SUNAT_REGEX = /^[FBETV][0-9]{3}$/;
const serieFromDocId = (id) => String(id || '').split('-')[0] || '';

const buildDefaultConfig = () => ({
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
});

/**
 * Emite Factura / Boleta / Liquidación (04) / Guía Remitente (09) / Guía Transportista (31)
 */
const emitInvoiceDocument = async (invoiceData, credentials) => {
    const config = buildDefaultConfig();
    try {
        if (!invoiceData) return { status: 400, body: { success: false, error: 'Faltan los datos de la factura' } };
        const serieFactura = serieFromDocId(invoiceData.id);
        if (!SERIE_SUNAT_REGEX.test(serieFactura)) {
            return { status: 400, body: { success: false, error: `Serie inválida en el ID '${invoiceData.id}': debe ser F001-F999, B001-B999 o E001-E999` } };
        }

        const isFactura = !invoiceData.id?.startsWith('B') && !invoiceData.id?.startsWith('E') && !invoiceData.id?.startsWith('T') && !invoiceData.id?.startsWith('V');
        if (isFactura && (invoiceData.customerType === '1' || invoiceData.customerRuc?.length !== 11)) {
            return {
                status: 400,
                body: {
                    success: false,
                    error: 'RUC inválido: No se puede emitir una Factura Electrónica a un cliente con DNI (8 dígitos). Las Facturas exigen un RUC de 11 dígitos. Para clientes con DNI, debes emitir una Boleta.'
                }
            };
        }
        console.log('--- NUEVA PETICIÓN DE EMISIÓN ---');
        console.log('Datos Recibidos:', JSON.stringify(invoiceData, null, 2));

        // Usamos las credenciales enviadas o las del .env por defecto
        const hasCompanyCert = Boolean(credentials?.certBase64 && credentials.certBase64.length > 50);
        const currentConfig = {
            ruc: credentials?.ruc || config.ruc,
            user: credentials?.user || config.user,
            pass: credentials?.pass || config.pass,
            env: credentials?.env || config.env,
            certData: hasCompanyCert ? credentials.certBase64 : config.certPath,
            certPass: hasCompanyCert ? credentials.certPass : config.certPass,
            codEstablecimiento: credentials?.codEstablecimiento || config.codEstablecimiento || '0',
            codLocalAnexo: credentials?.codLocalAnexo || config.codLocalAnexo || '0'
        };

        const engine = new SunatEngine(currentConfig);

        // 1. Generar XML
        const xml = engine.buildInvoiceXml(invoiceData);
        console.log('XML Generado (sin firma):', xml.substring(0, 500) + '...');

        // 2. Firmar XML
        const signedXml = await engine.signXml(xml, currentConfig.certData, currentConfig.certPass);
        console.log('XML Firmado (primeros 500 caracteres):', signedXml.substring(0, 500) + '...');

        // 3. Enviar a SUNAT
        const tipoDoc = invoiceData.documentType || (invoiceData.id?.startsWith('B') ? '03' : invoiceData.id?.startsWith('E') ? '04' : invoiceData.id?.startsWith('T') ? '09' : invoiceData.id?.startsWith('V') ? '31' : '01');
        const idParts = (invoiceData.id || '').split('-');
        const series = idParts[0] || '';
        const numVal = parseInt(idParts[1] || '1', 10);
        const paddedCorrelative = String(numVal).padStart(8, '0');
        const formattedDocId = `${series}-${paddedCorrelative}`;
        invoiceData.id = formattedDocId;
        const fileName = `${currentConfig.ruc}-${tipoDoc}-${formattedDocId}`;
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
            return {
                status: 400,
                body: {
                    success: false,
                    error: faultString,
                    sunatResponse: response
                }
            };
        }

        return {
            status: 200,
            body: {
                success: true,
                message: 'Factura enviada a SUNAT',
                sunatResponse: response,
                xmlContent: signedXml,
                cdrBase64: cdrBase64,
                cdrCode: cdrCode,
                cdrDesc: cdrDesc
            }
        };
    } catch (error) {
        const fs = require('fs');
        console.error('--- ERROR EN PROCESO SUNAT ---');
        const sunatDetail = error.response?.data || error.message;
        console.error('Detalle SUNAT:', sunatDetail);
        fs.appendFileSync('error_sunat.log', `[${new Date().toISOString()}] ${error.stack}\nDetalle SUNAT: ${sunatDetail}\n\n`);
        // Extraer el faultstring real de SUNAT si viene en la respuesta
        const faultMatch = typeof sunatDetail === 'string' && sunatDetail.match(/<faultstring>([^<]+)<\/faultstring>/);
        const userError = faultMatch ? faultMatch[1] : 'Error en comunicación con SUNAT';
        return {
            status: 500,
            body: {
                success: false,
                error: userError,
                detail: sunatDetail
            }
        };
    }
};

/**
 * Emite Nota de Crédito (07) / Nota de Débito (08)
 */
const emitNoteDocument = async (noteType, noteData, credentials) => {
    const config = buildDefaultConfig();
    try {
        if (!noteData) return { status: 400, body: { success: false, error: 'Faltan los datos de la nota' } };

        // La serie de una nota es la serie del comprobante original (F001-F999 / B001-B999)
        const serieNota = String(noteData.serie || serieFromDocId(noteData.id) || '');
        if (!SERIE_SUNAT_REGEX.test(serieNota)) {
            return { status: 400, body: { success: false, error: `Serie inválida '${serieNota}': las notas usan la serie del comprobante original (F001-F999 / B001-B999)` } };
        }

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
        const engine = new SunatEngine(currentConfig);

        // Validación de emisor y receptor antes de contactar SUNAT
        const emisorRuc = String(currentConfig.ruc || '');
        if (emisorRuc.length !== 11) {
            return { status: 400, body: { success: false, error: 'Falta el RUC del emisor (11 dígitos). Configúralo en tu empresa o credenciales SUNAT.' } };
        }
        const cust = noteData.customer || {};
        const custDoc = cust.doc || noteData.customerDocNumber || noteData.customerRuc;
        const custName = cust.name || noteData.customerName;
        if (!custDoc) return { status: 400, body: { success: false, error: 'Falta el documento del cliente (receptor)' } };
        if (!custName) return { status: 400, body: { success: false, error: 'Falta el nombre del cliente (receptor)' } };

        const todayStr = new Date().toISOString().split('T')[0];
        noteData.issueDate = (noteData.issueDate || noteData.date || todayStr).toString().trim() || todayStr;
        noteData.date = noteData.issueDate;
        noteData.emitterName = noteData.emitterName || credentials?.emitterName || 'EMPRESA';
        if (noteData.originalDocId) {
            noteData.originalDocId = String(noteData.originalDocId).replace(/^BB([0-9]{3}-)/i, 'B$1').replace(/^FF([0-9]{3}-)/i, 'F$1');
        }

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
            return {
                status: 400,
                body: {
                    success: false,
                    error: faultString,
                    sunatResponse: response
                }
            };
        }

        // Extract CDR
        const cdrMatch = response.match(/<applicationResponse>([\s\S]*?)<\/applicationResponse>/);
        let cdrBase64 = null;
        if (cdrMatch) {
            cdrBase64 = cdrMatch[1].trim();
        }

        return {
            status: 200,
            body: {
                success: isAccepted,
                xmlContent: signedXml,
                cdrBase64,
                sunatStatus: isAccepted ? 'SENT' : 'REJECTED',
                raw: response
            }
        };
    } catch (error) {
        const sunatDetail = error.response?.data || error.message;
        const faultMatch = typeof sunatDetail === 'string' && sunatDetail.match(/<faultstring>([^<]+)<\/faultstring>/);
        return {
            status: 500,
            body: {
                success: false,
                error: faultMatch ? faultMatch[1] : 'Error al emitir nota',
                raw: sunatDetail
            }
        };
    }
};

module.exports = { emitInvoiceDocument, emitNoteDocument, buildDefaultConfig, SERIE_SUNAT_REGEX, serieFromDocId };
