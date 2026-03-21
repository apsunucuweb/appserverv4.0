const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const isLinux = process.platform === 'linux';

async function createFtpUser(username, password, domain) {
    // Validate username format
    if (!/^[a-z_][a-z0-9_-]{0,31}$/.test(username)) {
        throw new Error('Geçersiz kullanıcı adı. Sadece küçük harf, rakam ve alt çizgi kullanılabilir.');
    }

    if (!isLinux) {
        console.log(`[MOCK] FTP Kullanıcısı oluşturuldu: ${username} -> /var/www/${domain}/public_html`);
        return true;
    }
    
    try {
        // Kullanıcının Linux üzerinde zaten mevcut olup olmadığını kontrol et
        try {
            await execPromise(`id -u ${username}`);
            throw new Error(`Kullanıcı "${username}" sistemde zaten mevcut.`);
        } catch (e) {
            if (e.message.includes('zaten mevcut')) throw e;
            // id komutu hata verirse kullanıcı yok demektir, devam et.
        }

        const homeDir = `/var/www/${domain}/public_html`;
        
        // 1. Kullanıcıyı oluştur (Shell erişimi olmadan)
        await execPromise(`useradd -d ${homeDir} -s /bin/false ${username}`);
        
        // 2. Şifreyi belirle (chpasswd ile)
        await execPromise(`echo "${username}:${password}" | chpasswd`);
        
        // 3. İzinleri ayarla (vsftpd chroot gereksinimi)
        await execPromise(`chown -R ${username}:${username} ${homeDir}`);
        
        console.log(`FTP Kullanıcısı Linux üzerinde başarıyla oluşturuldu: ${username}`);
        return true;
    } catch (err) {
        console.error('FTP User Error:', err);
        throw new Error(err.message || 'FTP kullanıcısı oluşturulamadı.');
    }
}

async function deleteFtpUser(username) {
    if (!isLinux) {
        console.log(`[MOCK] FTP Kullanıcısı silindi: ${username}`);
        return true;
    }
    
    try {
        // userdel -f ile kullanıcıyı sil
        await execPromise(`userdel -f ${username}`);
        return true;
    } catch (err) {
        console.error('FTP User Del Error:', err);
        throw new Error('FTP kullanıcısı silinirken Linux komut hatası oluştu.');
    }
}

module.exports = {
    createFtpUser,
    deleteFtpUser
};
