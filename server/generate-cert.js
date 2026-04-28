const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dir = path.join(__dirname, 'cert');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

// Generate using Node.js built-in crypto (Node 15+)
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

// Create self-signed certificate using X509Certificate (Node 15+)
const cert = crypto.X509Certificate;

// Since Node doesn't have a built-in cert generator, create using forge-like approach
// Write a simple script that creates the cert
const forge = (() => {
  try { return require('node-forge'); } catch(e) { return null; }
})();

if (!forge) {
  // Fallback: use the selfsigned package differently
  const selfsigned = require('selfsigned');
  const result = selfsigned.generate([{ name: 'commonName', value: 'careband' }], {
    days: 1825, keySize: 2048
  });
  
  console.log('Result type:', typeof result, Array.isArray(result));
  console.log('Result:', JSON.stringify(result).substring(0, 200));
  
  if (Array.isArray(result)) {
    // It's an array of {name, value} pairs
    const keyItem = result.find(r => r.name === 'private' || r.name === 'serviceKey');
    const certItem = result.find(r => r.name === 'cert' || r.name === 'certificate');
    if (keyItem) fs.writeFileSync(path.join(dir, 'key.pem'), keyItem.value);
    if (certItem) fs.writeFileSync(path.join(dir, 'cert.pem'), certItem.value);
  } else if (result && typeof result === 'object') {
    // Try all possible property names
    const key = result.private || result.privateKey || result.key || result.serviceKey;
    const crt = result.cert || result.certificate || result.public;
    if (key) fs.writeFileSync(path.join(dir, 'key.pem'), key);
    if (crt) fs.writeFileSync(path.join(dir, 'cert.pem'), crt);
  }
  
  if (fs.existsSync(path.join(dir, 'key.pem'))) {
    console.log('SSL certificates created!');
  } else {
    console.log('Failed to extract certs. Writing raw key pair instead.');
    fs.writeFileSync(path.join(dir, 'key.pem'), privateKey);
    // Can't create a proper cert without openssl/forge, but key is there
  }
} else {
  // Use node-forge
  const pki = forge.pki;
  const keys = pki.rsa.generateKeyPair(2048);
  const c = pki.createCertificate();
  c.publicKey = keys.publicKey;
  c.serialNumber = '01';
  c.validity.notBefore = new Date();
  c.validity.notAfter = new Date();
  c.validity.notAfter.setFullYear(c.validity.notBefore.getFullYear() + 5);
  const attrs = [{ name: 'commonName', value: 'careband' }];
  c.setSubject(attrs);
  c.setIssuer(attrs);
  c.sign(keys.privateKey);
  
  fs.writeFileSync(path.join(dir, 'key.pem'), pki.privateKeyToPem(keys.privateKey));
  fs.writeFileSync(path.join(dir, 'cert.pem'), pki.certificateToPem(c));
  console.log('SSL certificates created with node-forge!');
}
