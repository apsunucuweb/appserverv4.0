const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const execPromise = util.promisify(exec);
const isLinux = process.platform === 'linux';

async function installSSL(domain, email = 'admin@' + domain) {
    if (!isLinux) {
        console.log(`[MOCK] SSL Sertifikası kuruldu (Certbot simülasyonu): ${domain}`);
        return true;
    }
    
    try {
        const certPath = `/etc/letsencrypt/live/${domain}/fullchain.pem`;
        if (fs.existsSync(certPath)) {
            console.log(`[SSL] Sertifika zaten mevcut: ${domain}`);
            return true;
        }

        // Runs certbot for nginx in non-interactive mode. Only requests for root domain to avoid www resolution issues on dynamic subdomains.
        const cmd = `certbot --nginx -d ${domain} --non-interactive --agree-tos --register-unsafely-without-email --redirect`;
        const { stdout, stderr } = await execPromise(cmd);
        console.log('Certbot Output:', stdout);
        return true;
    } catch (err) {
        console.error('Certbot Error:', err);
        throw new Error('SSL kurulum işlemi başarısız. Lütfen alan adınızın (' + domain + ') bu sunucu IP adresine tam olarak yönlendiğinden (DNS Propagation) emin olun.');
    }
}

module.exports = {
    installSSL
};
