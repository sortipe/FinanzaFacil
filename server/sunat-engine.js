const fs = require('fs');
const path = require('path');
const { create } = require('xmlbuilder2');
const forge = require('node-forge');
const { SignedXml } = require('xml-crypto');
const axios = require('axios');
const AdmZip = require('adm-zip');

/**
 * Motor de Facturación Directa SUNAT (UBL 2.1)
 */
class SunatEngine {
    constructor(config) {
        this.config = config;
    }

    /**
     * Genera el XML UBL 2.1 para una Factura
     */

    buildInvoiceXml(data) {
        const doc = create({ version: '1.0', encoding: 'UTF-8', standalone: 'no' })
            .ele('Invoice', {
                'xmlns': 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
                'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
                'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
                'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
                'xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2'
            })
            .com(`Generado por FinanzaFacil Motor Directo v5.2 - ${new Date().toLocaleString()}`);

        // La firma se insertará dinámicamente en signXml


        // 2. Información de Cabecera (Obligatorio en este orden)
        doc.ele('cbc:UBLVersionID').txt('2.1').up()
           .ele('cbc:CustomizationID').txt('2.0').up()
           .ele('cbc:ID').txt(data.id).up()
           .ele('cbc:IssueDate').txt(data.issueDate).up()
           .ele('cbc:IssueTime').txt(data.issueTime || '00:00:00').up()
           .ele('cbc:InvoiceTypeCode', { listID: '0101' }).txt('01').up()
           .ele('cbc:DocumentCurrencyCode').txt(data.currency || 'PEN').up();

        const invoice = doc;
        invoice.ele('cac:Signature')
                .ele('cbc:ID').txt(this.config.ruc).up()
                .ele('cac:SignatoryParty')
                    .ele('cac:PartyIdentification')
                        .ele('cbc:ID').txt(this.config.ruc).up()
                    .up()
                    .ele('cac:PartyName')
                        .ele('cbc:Name').txt(data.emitterName).up()
                    .up()
                .up()
                .ele('cac:DigitalSignatureAttachment')
                    .ele('cac:ExternalReference')
                        .ele('cbc:URI').txt('#SignatureSUNAT').up()
                    .up()
                .up()
            .up()
            
        invoice.ele('cac:AccountingSupplierParty')
                .ele('cac:Party')
                    .ele('cac:PartyIdentification')
                        .ele('cbc:ID', { schemeID: '6' }).txt(this.config.ruc).up()
                    .up()
                    .ele('cac:PartyLegalEntity')
                        .ele('cbc:RegistrationName').txt(data.emitterName).up()
                    .up()
                .up()
            .up();
            
        invoice.ele('cac:AccountingCustomerParty')
                .ele('cac:Party')
                    .ele('cac:PartyIdentification')
                        .ele('cbc:ID', { schemeID: data.customerType }).txt(data.customerRuc).up()
                    .up()
                    .ele('cac:PartyLegalEntity')
                        .ele('cbc:RegistrationName').txt(data.customerName).up()
                    .up()
                .up()
            .up();
        // 3. Forma de Pago
        invoice.ele('cac:PaymentTerms')
                .ele('cbc:ID').txt('FormaPago').up()
                .ele('cbc:PaymentMeansID').txt(data.paymentType === 'CREDITO' ? 'Credito' : 'Contado').up()
                .ele('cbc:Amount', { currencyID: data.currency || 'PEN' }).txt(data.total).up()
        .up();

        if (data.paymentType === 'CREDITO') {
            invoice.ele('cac:PaymentTerms')
                .ele('cbc:ID').txt('FormaPago').up()
                .ele('cbc:PaymentMeansID').txt('Cuota001').up()
                .ele('cbc:Amount', { currencyID: data.currency || 'PEN' }).txt(data.total).up()
                .ele('cbc:PaymentDueDate').txt(data.issueDate).up() // Por defecto hoy, el usuario puede cambiarlo luego
            .up();
        }


        // Cálculo de impuestos (Asumiendo 18% IGV incluido en el total para este ejemplo)
        const total = parseFloat(data.total);
        const gravada = total / 1.18;
        const igv = total - gravada;

        doc.ele('cac:TaxTotal')
            .ele('cbc:TaxAmount', { currencyID: data.currency || 'PEN' }).txt(igv.toFixed(2)).up()
            .ele('cac:TaxSubtotal')
                .ele('cbc:TaxableAmount', { currencyID: data.currency || 'PEN' }).txt(gravada.toFixed(2)).up()
                .ele('cbc:TaxAmount', { currencyID: data.currency || 'PEN' }).txt(igv.toFixed(2)).up()
                .ele('cac:TaxCategory')
                    .ele('cac:TaxScheme')
                        .ele('cbc:ID').txt('1000').up()
                        .ele('cbc:Name').txt('IGV').up()
                        .ele('cbc:TaxTypeCode').txt('VAT').up()
                    .up()
                .up()
            .up()
        .up();

        if (data.hasDetraction) {
            const detractionAmount = (total * (data.detractionPercent || 10)) / 100;
            invoice.ele('cac:PaymentTerms')
                .ele('cbc:ID').txt('Detraccion').up()
                .ele('cbc:PaymentMeansID').txt(data.detractionCode || '001').up()
                .ele('cbc:Percent').txt(data.detractionPercent || '10').up()
                .ele('cbc:Amount', { currencyID: 'PEN' }).txt(detractionAmount.toFixed(2)).up()
            .up();
        }

        doc.ele('cac:LegalMonetaryTotal')
            .ele('cbc:LineExtensionAmount', { currencyID: data.currency || 'PEN' }).txt(gravada.toFixed(2)).up()
            .ele('cbc:TaxInclusiveAmount', { currencyID: data.currency || 'PEN' }).txt(total.toFixed(2)).up()
            .ele('cbc:PayableAmount', { currencyID: data.currency || 'PEN' }).txt(total.toFixed(2)).up()
        .up();

        // Una sola línea de detalle
        doc.ele('cac:InvoiceLine')
            .ele('cbc:ID').txt('1').up()
            .ele('cbc:InvoicedQuantity', { unitCode: 'NIU' }).txt('1').up()
            .ele('cbc:LineExtensionAmount', { currencyID: data.currency || 'PEN' }).txt(gravada.toFixed(2)).up()
            .ele('cac:PricingReference')
                .ele('cac:AlternativeConditionPrice')
                    .ele('cbc:PriceAmount', { currencyID: data.currency || 'PEN' }).txt(total.toFixed(2)).up()
                    .ele('cbc:PriceTypeCode').txt('01').up()
                .up()
            .up()
            .ele('cac:TaxTotal')
                .ele('cbc:TaxAmount', { currencyID: data.currency || 'PEN' }).txt(igv.toFixed(2)).up()
                .ele('cac:TaxSubtotal')
                    .ele('cbc:TaxableAmount', { currencyID: data.currency || 'PEN' }).txt(gravada.toFixed(2)).up()
                    .ele('cbc:TaxAmount', { currencyID: data.currency || 'PEN' }).txt(igv.toFixed(2)).up()
                    .ele('cac:TaxCategory')
                        .ele('cbc:Percent').txt('18.00').up()
                        .ele('cbc:TaxExemptionReasonCode').txt('10').up()
                        .ele('cac:TaxScheme')
                            .ele('cbc:ID').txt('1000').up()
                            .ele('cbc:Name').txt('IGV').up()
                            .ele('cbc:TaxTypeCode').txt('VAT').up()
                        .up()
                    .up()
                .up()
            .up()
            .ele('cac:Item')
                .ele('cbc:Description').txt(data.items?.[0]?.description || 'Servicios Profesionales').up()
            .up()
            .ele('cac:Price')
                .ele('cbc:PriceAmount', { currencyID: data.currency || 'PEN' }).txt(gravada.toFixed(2)).up()
            .up()
        .up();

        return doc.end({ prettyPrint: false });
    }

    /**
     * Firma el XML con el certificado PFX (puede ser un path o un Buffer/Base64)
     */
    async signXml(xmlString, certData, certPass) {
        let pfxBuffer;
        if (Buffer.isBuffer(certData)) {
            pfxBuffer = certData;
        } else if (certData.startsWith('data:') || certData.length > 500) {
            // Asumimos que es Base64 si es muy largo
            const base64 = certData.includes('base64,') ? certData.split('base64,')[1] : certData;
            pfxBuffer = Buffer.from(base64, 'base64');
        } else if (fs.existsSync(certData)) {
            pfxBuffer = fs.readFileSync(certData);
        } else {
            throw new Error('Certificado no válido o no encontrado');
        }

        const pfxAsn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
        const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, certPass);
        
        // ... resto de la lógica de firmado (se mantiene igual)

        const bags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
        const keyBag = bags[forge.pki.oids.pkcs8ShroudedKeyBag][0];
        const privateKey = forge.pki.privateKeyToPem(keyBag.key);

        const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
        const certBag = certBags[forge.pki.oids.certBag][0];
        const certificate = forge.pki.certificateToPem(certBag.cert);





        const sig = new SignedXml();
        sig.signatureAlgorithm = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
        sig.canonicalizationAlgorithm = "http://www.w3.org/2001/10/xml-exc-c14n#";
        
        // Limpiamos el certificado de cabeceras y saltos de línea
        const cleanCert = certificate
            .replace(/-----BEGIN CERTIFICATE-----/g, "")
            .replace(/-----END CERTIFICATE-----/g, "")
            .replace(/[\r\n\t ]/g, "");


        sig.keyInfoProvider = {
            getKeyInfo: (key, prefix) => `<ds:X509Data><ds:X509Certificate>${cleanCert}</ds:X509Certificate></ds:X509Data>`
        };

        sig.addReference(
            "//*[local-name(.)='Invoice']", 
            ["http://www.w3.org/2000/09/xmldsig#enveloped-signature", "http://www.w3.org/2001/10/xml-exc-c14n#"], 
            "http://www.w3.org/2001/04/xmlenc#sha256"
        );
        
        sig.signingKey = privateKey;
        sig.computeSignature(xmlString, { prefix: 'ds' });
        
        let signatureXml = sig.getSignatureXml();
        
        // Asegurar Id obligatorio
        if (!signatureXml.includes('Id="SignatureSUNAT"')) {
            signatureXml = signatureXml.replace('<ds:Signature', '<ds:Signature Id="SignatureSUNAT"');
        }
        
        // Construir el bloque de extensiones UBL
        const extensionsXml = `<ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent>${signatureXml}</ext:ExtensionContent></ext:UBLExtension></ext:UBLExtensions>`;
        
        // Insertar las extensiones como primer hijo del nodo Invoice
        // Buscamos el final de la etiqueta de apertura <Invoice ... >
        return xmlString.replace(/(<Invoice[^>]*>)/, `$1${extensionsXml}`);
    }


    /**
     * Envía el XML comprimido a SUNAT vía SOAP
     */
    async sendToSunat(fileName, xmlContent, dynamicConfig) {
        const conf = dynamicConfig || this.config;
        const zip = new AdmZip();
        zip.addFile(`${fileName}.xml`, Buffer.from(xmlContent, 'utf-8'));
        const zipBase64 = zip.toBuffer().toString('base64');

        const soapEnvelope = `
            <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://service.sunat.gob.pe" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
                <soapenv:Header>
                    <wsse:Security>
                        <wsse:UsernameToken>
                            <wsse:Username>${conf.ruc}${conf.user}</wsse:Username>
                            <wsse:Password>${conf.pass}</wsse:Password>
                        </wsse:UsernameToken>
                    </wsse:Security>
                </soapenv:Header>
                <soapenv:Body>
                    <ser:sendBill>
                        <fileName>${fileName}.zip</fileName>
                        <contentFile>${zipBase64}</contentFile>
                    </ser:sendBill>
                </soapenv:Body>
            </soapenv:Envelope>
        `;

        const url = conf.env === 'PRODUCTION' 
            ? 'https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService'
            : 'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService';
        
        // ... resto de la lógica de axios


        const response = await axios.post(url, soapEnvelope, {
            headers: {
                'Content-Type': 'text/xml;charset=utf-8',
                'SOAPAction': 'urn:sendBill'
            }
        });

        return response.data;
    }
}

module.exports = SunatEngine;
