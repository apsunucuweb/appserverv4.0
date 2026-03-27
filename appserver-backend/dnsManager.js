const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const isLinux = process.platform === 'linux';
const BIND_DIR = isLinux ? '/etc/bind' : path.join(__dirname, 'mock_bind');

if (!isLinux) {
    fs.mkdirSync(BIND_DIR, { recursive: true });
    if (!fs.existsSync(path.join(BIND_DIR, 'named.conf.local'))) {
        fs.writeFileSync(path.join(BIND_DIR, 'named.conf.local'), '');
    }
}

async function createDnsZone(domain, ipAddress, ns1 = 'ns1', ns2 = 'ns2', customRecords = []) {
    if (!isLinux) {
        console.log(`[MOCK] DNS Zone created for ${domain} pointing to ${ipAddress} with NS: ${ns1}, ${ns2}. Custom Records: ${customRecords.length}`);
        return true;
    }

    const zoneFilePath = path.join(BIND_DIR, `db.${domain}`);
    
    // Ensure ns ends with dot
    const cleanNs1 = ns1.endsWith('.') ? ns1 : `${ns1}.`;
    const cleanNs2 = ns2.endsWith('.') ? ns2 : `${ns2}.`;

    // Default Web Records
    let defaultRecords = `
@       IN      NS      ${cleanNs1}
@       IN      NS      ${cleanNs2}
@       IN      A       ${ipAddress}
www     IN      A       ${ipAddress}
mail    IN      A       ${ipAddress}
ftp     IN      A       ${ipAddress}
ns1     IN      A       ${ipAddress}
ns2     IN      A       ${ipAddress}
`;
    // Add User Custom Records
    customRecords.forEach(rec => {
        if(rec.type === 'MX') {
            defaultRecords += `${rec.name} IN MX ${rec.priority} ${rec.value}\n`;
        } else {
            defaultRecords += `${rec.name} IN ${rec.type} ${rec.value}\n`;
        }
    });

    // Zone Content
    const zoneContent = `; BIND data file for ${domain}\n$TTL    604800
@       IN      SOA     ${cleanNs1} admin.${domain}. (
                              2         ; Serial
                         604800         ; Refresh
                          86400         ; Retry
                        2419200         ; Expire
                         604800 )       ; Negative Cache TTL
${defaultRecords}
`;

    fs.writeFileSync(zoneFilePath, zoneContent);

    // Register in named.conf.local
    const namedConfPath = path.join(BIND_DIR, 'named.conf.local');
    const zoneRegistration = `\nzone "${domain}" {\n    type master;\n    file "${zoneFilePath}";\n};\n`;
    
    let currentConf = fs.readFileSync(namedConfPath, 'utf8');
    if (!currentConf.includes(`zone "${domain}"`)) {
        fs.appendFileSync(namedConfPath, zoneRegistration);
    }

    return reloadBind();
}

async function deleteDnsZone(domain) {
    const zoneFilePath = path.join(BIND_DIR, `db.${domain}`);
    if (fs.existsSync(zoneFilePath)) {
        fs.unlinkSync(zoneFilePath);
    }

    const namedConfPath = path.join(BIND_DIR, 'named.conf.local');
    if (fs.existsSync(namedConfPath)) {
        let conf = fs.readFileSync(namedConfPath, 'utf8');
        // Remove zone block
        const regex = new RegExp(`zone "${domain}" \\{[\\s\\S]*?\\};\\n?`, 'g');
        conf = conf.replace(regex, '');
        fs.writeFileSync(namedConfPath, conf);
    }
    return reloadBind();
}

async function reloadBind() {
    if (isLinux) {
        try {
            await execPromise('systemctl reload bind9');
            return true;
        } catch (error) {
            throw new Error(`BIND9 reload failed. Ensure bind9 is installed and configurations are valid: ${error.message}`);
        }
    }
    return true;
}

module.exports = {
    createDnsZone,
    deleteDnsZone
};
