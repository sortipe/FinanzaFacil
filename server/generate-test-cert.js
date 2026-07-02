const forge = require('node-forge');
const fs = require('fs');
const pki = forge.pki;

// Generar par de llaves
const keys = pki.rsa.generateKeyPair(2048);

// Crear certificado
const cert = pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = '01';
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

const attrs = [
  { name: 'commonName', value: 'SUNAT_PRUEBA' },
  { name: 'countryName', value: 'PE' },
  { shortName: 'ST', value: 'Lima' },
  { name: 'localityName', value: 'Lima' },
  { name: 'organizationName', value: 'Prueba Local' },
  { shortName: 'OU', value: 'TI' }
];

cert.setSubject(attrs);
cert.setIssuer(attrs);
cert.sign(keys.privateKey);



// Convertir a PFX
const pfx = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], '123456');
const pfxDer = forge.asn1.toDer(pfx).getBytes();

fs.writeFileSync('certificate.pfx', pfxDer, 'binary');

console.log('Certificado de prueba generado: certificate.pfx (Clave: 123456)');


