const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const isLinux = process.platform === 'linux';

// Mail sunucusunu virtual mailbox altyapısına uygun olarak en başından konfigüre eder. (Startupta 1 kere çalışır)
async function configureMailServer() {
    if (!isLinux) return;
    try {
        console.log('E-Posta (Postfix & Dovecot) Virtual Mail Sunucu Ayarları Yapılıyor...');
        // Vmail kullanıcısı (Sistem mailleri bu kullanıcının üstünde tutulur)
        await execPromise('id -u vmail || (groupadd -g 5000 vmail && useradd -u 5000 -g vmail -s /usr/sbin/nologin -d /var/vmail -m vmail)');
        
        // Postfix Yönlendirme Ayarları
        await execPromise(`postconf -e "virtual_mailbox_domains = hash:/etc/postfix/vmail_domains"`);
        await execPromise(`postconf -e "virtual_mailbox_maps = hash:/etc/postfix/vmailbox"`);
        await execPromise(`postconf -e "virtual_alias_maps = hash:/etc/postfix/virtual"`);
        await execPromise(`postconf -e "virtual_uid_maps = static:5000"`);
        await execPromise(`postconf -e "virtual_gid_maps = static:5000"`);
        await execPromise(`postconf -e "virtual_mailbox_base = /var/vmail"`);
        
        // Dovecot (Okuma / IMAP) Ayarları
        const dovecotAuthConf = '/etc/dovecot/conf.d/10-auth.conf';
        
        // Önceki çelişkili veya PAM'ı çağıran varsayılan ayarları tamamen ezip temizliyoruz
        const cleanAuthData = `disable_plaintext_auth = no
auth_mechanisms = plain login
!include auth-passwdfile.conf.ext
`;
        fs.writeFileSync(dovecotAuthConf, cleanAuthData);

        const passwdFileExt = '/etc/dovecot/conf.d/auth-passwdfile.conf.ext';
        const passwdFileContent = `
passdb {
  driver = passwd-file
  args = username_format=%u /etc/dovecot/users
}
userdb {
  driver = static
  args = uid=vmail gid=vmail home=/var/vmail/%d/%n
}
`;
        fs.writeFileSync(passwdFileExt, passwdFileContent);
        
        // Mail adresleri dizini, formatlaması ve Namespace(Gelen kutusu kök yolu)
        const mailConfContent = `mail_location = maildir:/var/vmail/%d/%n/Maildir
namespace inbox {
  inbox = yes
  separator = /
}
`;
        fs.writeFileSync('/etc/dovecot/conf.d/10-mail.conf', mailConfContent);

        // Kullanıcı veritabanı (Dovecot Şifre Dosyası)
        if (!fs.existsSync('/etc/dovecot/users')) {
            fs.writeFileSync('/etc/dovecot/users', '');
            await execPromise('chown dovecot:root /etc/dovecot/users && chmod 600 /etc/dovecot/users');
        }

        await execPromise('systemctl restart postfix dovecot || true');
        console.log('Mail sunucusu başarıyla aktif.');
    } catch (e) {
        console.error('Mail sunucusu başlatılırken hata: ', e.message);
    }
}

// Yeni mail hesabı eklendiğinde/silindiğinde harita (.db) dosyalarını yeniler.
async function rebuildPostfixMaps(mailAccounts, actionData = null) {
    if (!isLinux) return;

    // Şifre ekleme veya çıkartma işlemi
    if (actionData) {
        const usersFile = '/etc/dovecot/users';
        let usersData = fs.existsSync(usersFile) ? fs.readFileSync(usersFile, 'utf8') : '';
        let lines = usersData.split('\n').filter(l => l.trim() !== '');
        
        // Bu adresi dosyadan her halükarda çıkar (güncelleme veya silme)
        lines = lines.filter(l => !l.startsWith(`${actionData.email}:`));
        
        if (!actionData.delete && actionData.password) {
            try {
                // Dovecot'un kendi aracıyla güvenli CRYPT Hash oluşturuyoruz.
                // Parolayı bash değişkeni veya komut zafiyetinden (örneğin $ veya ') korumak için güvenli formatlama:
                const safePassword = actionData.password.replace(/'/g, "'\\''");
                const { stdout } = await execPromise(`doveadm pw -s SHA512-CRYPT -p '${safePassword}'`);
                const hash = stdout.trim();
                lines.push(`${actionData.email}:${hash}`);
            } catch(e) { console.error('Doveadm password hash error:', e); }
        }
        
        fs.writeFileSync(usersFile, lines.join('\n') + '\n');
    }

    let vmailboxContent = '';
    let virtualContent = '';
    let domains = new Set();

    mailAccounts.forEach(account => {
        const domain = account.username.split('@')[1];
        if(!domain) return;
        domains.add(domain);
        
        vmailboxContent += `${account.username} ${domain}/${account.username.split('@')[0]}/\n`;
        virtualContent += `${account.username} ${account.username}\n`;
    });

    fs.writeFileSync('/etc/postfix/vmailbox', vmailboxContent);
    fs.writeFileSync('/etc/postfix/virtual', virtualContent);
    
    let domainStr = Array.from(domains).map(d => `${d} OK`).join('\n') + '\n';
    fs.writeFileSync('/etc/postfix/vmail_domains', domainStr);

    try {
        await execPromise('postmap /etc/postfix/vmailbox');
        await execPromise('postmap /etc/postfix/virtual');
        await execPromise('postmap /etc/postfix/vmail_domains');
        await execPromise('systemctl reload postfix dovecot || true');
    } catch (e) { console.error('Postfix map yenileme hatası:', e.message); }
    
    return true;
}

module.exports = { rebuildPostfixMaps, configureMailServer };
