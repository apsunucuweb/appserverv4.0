const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const isLinux = process.platform === 'linux';

// Simulate a Softaculous style 1-click app installer
async function installWordpress(domain) {
    const webRoot = isLinux ? `/var/www/${domain}/public_html` : path.join(__dirname, 'mock_var_www', domain, 'public_html');
    
    // Klasör yoksa dert etme, zorla oluştur.
    if (!fs.existsSync(webRoot)) {
        fs.mkdirSync(webRoot, { recursive: true });
    }
    
    if (isLinux) {
        // Download latest WordPress, extract, delete default index.html, and set permissions
        const cmd = `cd ${webRoot} && rm -f index.html index.php && wget -qO wp.tar.gz https://wordpress.org/latest.tar.gz && tar -xzf wp.tar.gz --strip-components=1 && rm wp.tar.gz && chown -R www-data:www-data .`;
        try {
            await execPromise(cmd);
            return true;
        } catch(e) { throw new Error(`WordPress download failed: ${e.message}`); }
    } else {
        // Mock install
        fs.writeFileSync(path.join(webRoot, 'index.php'), '<?php echo "<h1>Welcome to your new AppServer WordPress Site!</h1>"; ?>');
        return true;
    }
}

async function installLaravel(domain) {
    const webRoot = isLinux ? `/var/www/${domain}` : path.join(__dirname, 'mock_var_www', domain);
    
    if (!fs.existsSync(webRoot)) {
        fs.mkdirSync(webRoot, { recursive: true });
    }
    
    if (isLinux) {
        // Uses composer to create project inside a temp folder, then swap public_html
        const cmd = `cd ${webRoot} && rm -rf public_html && composer create-project --prefer-dist laravel/laravel public_html && chown -R www-data:www-data public_html`;
        try {
            await execPromise(cmd);
            return true;
        } catch(e) { throw new Error(`Laravel composer install failed. Make sure composer is installed globally: ${e.message}`); }
    } else {
        let pubHtml = path.join(webRoot, 'public_html');
        if(!fs.existsSync(pubHtml)) fs.mkdirSync(pubHtml, {recursive: true});
        fs.writeFileSync(path.join(pubHtml, 'index.php'), '<?php echo "<h1>Laravel Framework Mock Ready!</h1>"; ?>');
        return true;
    }
}

async function installSitepad(domain) {
    const webRoot = isLinux ? `/var/www/${domain}/public_html` : path.join(__dirname, 'mock_var_www', domain, 'public_html');
    
    if (!fs.existsSync(webRoot)) {
        fs.mkdirSync(webRoot, { recursive: true });
    }
    
    // SitePad aslında API üzerinden çalışır ancak AppServer V6'da bir başlangıç arayüzü/template yerleştiriyoruz
    const sitepadTemplate = `<!DOCTYPE html>
<html>
<head>
    <title>SitePad Website Builder</title>
    <style>body { font-family: sans-serif; text-align: center; padding: 50px; background: #f4f4f5; }</style>
</head>
<body>
    <h1>SitePad Builder Hazır!</h1>
    <p>Softaculous SitePad başarıyla ${domain} domainine entegre edildi.</p>
    <a href="/sitepad-editor" style="padding: 10px 20px; background: #3b82f6; color: white; text-decoration: none; border-radius: 5px;">Siteyi Düzenlemeye Başla</a>
</body>
</html>`;

    if (isLinux) {
        const cmd = `cd ${webRoot} && rm -f index.html index.php`;
        try {
            await execPromise(cmd);
            fs.writeFileSync(`${webRoot}/index.html`, sitepadTemplate);
            await execPromise(`chown -R www-data:www-data ${webRoot}`);
            return true;
        } catch(e) { throw new Error(`SitePad integration failed: ${e.message}`); }
    } else {
        fs.writeFileSync(path.join(webRoot, 'index.html'), sitepadTemplate);
        return true;
    }
}

module.exports = { installWordpress, installLaravel, installSitepad };
