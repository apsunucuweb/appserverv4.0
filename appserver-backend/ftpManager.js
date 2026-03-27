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
        let userExists = false;
        try {
            await execPromise(`id -u ${username}`);
            userExists = true;
        } catch (e) {
            userExists = false;
        }

        const homeDir = `/var/www/${domain}/public_html`;
        
        // 1. Kullanıcıyı oluştur (Sadece yoksa)
        if (!userExists) {
            // www-data grubuna dahil ediyoruz
            await execPromise(`useradd -d ${homeDir} -s /bin/false -G www-data ${username}`);
        }
        
        // 2. Şifreyi belirle 
        await execPromise(`echo "${username}:${password}" | chpasswd`);
        
        // 3. İleri Düzey Güvenli Yetkilendirme (ACL / SetGID / Sahiplik)
        // SetGID (2775) -> Klasör içinde oluşan yeni dosyalar her zaman www-data grubunu miras alır.
        // Böylece PHP (Web Sunucusu) ve FTP (Kullanıcı) çakışması asla yaşanmaz (777 riskine girmeden).
        await execPromise(`chown -R ${username}:www-data ${homeDir}`);
        await execPromise(`chmod -R 2775 ${homeDir}`);
        
        // ACL varsa default kuralları uygula (Her ihtimale karşı)
        try {
            await execPromise(`setfacl -R -m d:u:${username}:rwx,d:g:www-data:rwx ${homeDir}`);
            await execPromise(`setfacl -R -m u:${username}:rwx,g:www-data:rwx ${homeDir}`);
        } catch(e) { /* ACL yüklü değilse görmezden gel, 2775 genelde kurtarır */ }

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
