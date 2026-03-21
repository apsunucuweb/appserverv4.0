const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const isLinux = process.platform === 'linux';

async function createFtpUser(username, password, domain) {
    if (!isLinux) {
        console.log(`[MOCK] FTP Kullanıcısı oluşturuldu: ${username} -> /var/www/${domain}/public_html`);
        return true;
    }
    
    try {
        const homeDir = `/var/www/${domain}/public_html`;
        
        // 1. Kullanıcıyı oluştur (Shell erişimi olmadan)
        // Eğer kullanıcı zaten varsa, önce yakalamak için try-catch yapılabilir veya ignore edilebilir.
        await execPromise(`useradd -d ${homeDir} -s /bin/false ${username}`);
        
        // 2. Şifreyi belirle (chpasswd ile)
        await execPromise(`echo "${username}:${password}" | chpasswd`);
        
        // 3. İzinleri ayarla (vsftpd chroot gereksinimi için home klasörü kökü yazılamaz olmalı veya allow_writeable_chroot=YES olmalı)
        // Public_html içine yazma izni verilir.
        await execPromise(`chown -R ${username}:${username} ${homeDir}`);
        
        console.log(`FTP Kullanıcısı Linux üzerinde başarıyla oluşturuldu: ${username}`);
        return true;
    } catch (err) {
        console.error('FTP User Error:', err);
        throw new Error('FTP kullanıcısı oluşturulamadı. Kullanıcı adı (sistem seviyesinde) zaten kullanımda olabilir.');
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
