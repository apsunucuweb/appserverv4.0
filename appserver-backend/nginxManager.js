const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const isLinux = process.platform === 'linux';

// Yollar (Linux dışı geliştirme ortamları için mock / simülasyon)
const NGINX_SITES_AVAILABLE = isLinux ? '/etc/nginx/sites-available' : path.join(__dirname, 'mock_nginx', 'sites-available');
const NGINX_SITES_ENABLED = isLinux ? '/etc/nginx/sites-enabled' : path.join(__dirname, 'mock_nginx', 'sites-enabled');
const WEB_ROOT_BASE = isLinux ? '/var/www' : path.join(__dirname, 'mock_var_www');

// Geliştirme ortamında klasörleri oluştur (Windows/Mac)
if (!isLinux) {
    fs.mkdirSync(NGINX_SITES_AVAILABLE, { recursive: true });
    fs.mkdirSync(NGINX_SITES_ENABLED, { recursive: true });
    fs.mkdirSync(WEB_ROOT_BASE, { recursive: true });
}

async function createVhost(domain) {
    const webRoot = path.join(WEB_ROOT_BASE, domain, 'public_html');
    
    // Website klasörü (DocumentRoot) oluşturma
    if (!fs.existsSync(webRoot)) {
        fs.mkdirSync(webRoot, { recursive: true });
    }
    
    // Varsayılan index.html dosyası yazma
    const indexContent = `<!DOCTYPE html>
<html>
<head><title>Welcome to ${domain}!</title></head>
<body style="font-family: sans-serif; text-align: center; margin-top: 100px;">
    <h1>Mükemmel! ${domain} başarıyla kuruldu.</h1>
    <p>Bu site AppServer Web Hosting Yönetim Paneli tarafından otomatik oluşturuldu.</p>
</body>
</html>`;
    fs.writeFileSync(path.join(webRoot, 'index.html'), indexContent);
    
    // Nginx yapılandırma (.conf) dosyası
    const nginxConfig = `server {
    listen 80;
    server_name ${domain} www.${domain};
    root ${isLinux ? `/var/www/${domain}/public_html` : webRoot.replace(/\\/g, '/')};
    index index.html index.php;

    location / {
        try_files $uri $uri/ =404;
    }
}`;

    const confPath = path.join(NGINX_SITES_AVAILABLE, `${domain}.conf`);
    fs.writeFileSync(confPath, nginxConfig);
    
    // Sitelerin aktif edilmesi için sembolik bağ (Symlink)
    const symlinkPath = path.join(NGINX_SITES_ENABLED, `${domain}.conf`);
    if (!fs.existsSync(symlinkPath)) {
        if (isLinux) {
            fs.symlinkSync(confPath, symlinkPath);
        } else {
            // Windows'ta simüle et
            fs.copyFileSync(confPath, symlinkPath);
        }
    }
    
    // Nginx servisini yeni ayarları okuması için yeniden yükle
    return reloadNginx();
}

async function deleteVhost(domain) {
    const confPath = path.join(NGINX_SITES_AVAILABLE, `${domain}.conf`);
    const symlinkPath = path.join(NGINX_SITES_ENABLED, `${domain}.conf`);
    const webRoot = path.join(WEB_ROOT_BASE, domain);
    
    // Dosyaları ve yapılandırmayı sil
    if (fs.existsSync(confPath)) fs.unlinkSync(confPath);
    if (fs.existsSync(symlinkPath)) fs.unlinkSync(symlinkPath);
    if (fs.existsSync(webRoot)) fs.rmSync(webRoot, { recursive: true, force: true });
    
    return reloadNginx();
}

async function reloadNginx() {
    if (isLinux) {
        try {
            await execPromise('systemctl restart nginx');
            console.log('Nginx başarıyla yeniden başlatıldı.');
            return true;
        } catch (error) {
            console.error('Nginx çalıştırılamadı:', error.message);
            throw new Error(`Nginx yeniden başlatılamadı! Detay: ${error.message}`);
        }
    } else {
        console.log('[MOCK] Nginx systemctl reload komutu çalıştırıldı gibi kabul edildi (Dev Mod).');
        return true;
    }
}

module.exports = {
    createVhost,
    deleteVhost,
    reloadNginx
};
