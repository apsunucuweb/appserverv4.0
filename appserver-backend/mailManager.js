const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const isLinux = process.platform === 'linux';
const POSTFIX_VMAILBOX = isLinux ? '/etc/postfix/vmailbox' : path.join(__dirname, 'mock_postfix', 'vmailbox');
const POSTFIX_VIRTUAL = isLinux ? '/etc/postfix/virtual' : path.join(__dirname, 'mock_postfix', 'virtual');

async function ensureMockDirs() {
    if (!isLinux) {
        if(!fs.existsSync(path.dirname(POSTFIX_VMAILBOX))) {
            fs.mkdirSync(path.dirname(POSTFIX_VMAILBOX), {recursive: true});
        }
    }
}

async function rebuildPostfixMaps(mailAccounts) {
    await ensureMockDirs();
    let vmailboxContent = '# AppServer Auto-Generated Mailboxes\\n';
    let virtualContent = '# AppServer Auto-Generated Aliases\\n';

    mailAccounts.forEach(account => {
        const domain = account.username.split('@')[1];
        if(!domain) return;
        
        // Postfix vmailbox format: email_address domain/email_prefix/
        // Dovecot format is usually managed by database, but if we do file-based:
        vmailboxContent += `${account.username} ${domain}/${account.username.split('@')[0]}/\\n`;
        // Basic catchall or direct alias map mapping identity to identity
        virtualContent += `${account.username} ${account.username}\\n`;
    });

    fs.writeFileSync(POSTFIX_VMAILBOX, vmailboxContent);
    fs.writeFileSync(POSTFIX_VIRTUAL, virtualContent);

    if (isLinux) {
        try {
            await execPromise('postmap /etc/postfix/vmailbox');
            await execPromise('postmap /etc/postfix/virtual');
            await execPromise('systemctl reload postfix || true');
        } catch (e) {
            console.log('Postfix reload error: ', e.message);
        }
    }
    return true;
}

module.exports = { rebuildPostfixMaps };
