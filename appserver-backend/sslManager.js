const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const isLinux = process.platform === 'linux';

async function installSSL(domain, email = 'admin@' + domain) {
    if (!isLinux) {
        console.log(`[MOCK] SSL Sertifikası kuruldu (Certbot simülasyonu): ${domain}`);
        return true;
    }
    
    try {
        // Runs certbot for nginx in non-interactive mode
        const cmd = `certbot --nginx -d ${domain} -d www.${domain} --non-interactive --agree-tos -m ${email} --redirect`;
        const { stdout, stderr } = await execPromise(cmd);
        console.log('Certbot Output:', stdout);
        return true;
    } catch (err) {
        console.error('Certbot Error:', err);
        throw new Error('SSL kurulum işlemi başarısız. Certbot veya Nginx yapılandırmasını kontrol edin.');
    }
}

module.exports = {
    installSSL
};
