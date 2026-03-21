const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const isLinux = process.platform === 'linux';
const NGINX_SITES_AVAILABLE = isLinux ? '/etc/nginx/sites-available' : path.join(__dirname, 'mock_nginx', 'sites-available');

const SUPPORTED_PHPS = {
    '7.4': 'unix:/var/run/php/php7.4-fpm.sock',
    '8.1': 'unix:/var/run/php/php8.1-fpm.sock',
    '8.2': 'unix:/var/run/php/php8.2-fpm.sock'
};

async function changePhpVersion(domain, version) {
    if (!SUPPORTED_PHPS[version]) {
        throw new Error('Unsupported PHP Version.');
    }

    const confPath = path.join(NGINX_SITES_AVAILABLE, `${domain}.conf`);
    if (!fs.existsSync(confPath)) {
        throw new Error(`Nginx virtual host file for ${domain} not found.`);
    }

    let conf = fs.readFileSync(confPath, 'utf8');

    // Create a fastcgi block if it doesn't exist, or replace the fastcgi_pass line.
    // This is a simple parser replacement.
    const socketPath = SUPPORTED_PHPS[version];

    if (conf.includes('fastcgi_pass')) {
        conf = conf.replace(/fastcgi_pass\s+[^;]+;/g, `fastcgi_pass ${socketPath};`);
    } else {
        // Inject PHP block into server block
        const phpBlock = `\n    location ~ \\.php$ {\n        include snippets/fastcgi-php.conf;\n        fastcgi_pass ${socketPath};\n    }\n`;
        // Insert before the last closing brace of the server block
        const lastBraceIndex = conf.lastIndexOf('}');
        if (lastBraceIndex !== -1) {
            conf = conf.slice(0, lastBraceIndex) + phpBlock + conf.slice(lastBraceIndex);
        }
    }

    fs.writeFileSync(confPath, conf);

    if (isLinux) {
        try {
            await execPromise('systemctl reload nginx');
        } catch (error) {
            throw new Error(`Failed to reload Nginx after PHP version change: ${error.message}`);
        }
    }
    
    return true;
}

module.exports = {
    changePhpVersion,
    SUPPORTED_PHPS
};
