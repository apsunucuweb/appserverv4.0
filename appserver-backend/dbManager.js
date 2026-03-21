const mysql = require('mysql2/promise');

const isLinux = process.platform === 'linux';

// Sadece Windows / Geliştirme ortamı için geçici kayıt tutucu
let mockDatabases = [];

async function createDatabase(dbName, dbUser, dbPass) {
    if (!isLinux) {
        console.log(`[MOCK] MariaDB Veritabanı oluşturuldu: ${dbName}, Kullanıcı: ${dbUser}`);
        mockDatabases.push({ dbName, dbUser });
        return true;
    }
    
    try {
        // Gerçek kullanım senaryosunda şifre config'den gelmelidir. MVP için standart root varsayılıyor.
        const connection = await mysql.createConnection({ host: 'localhost', user: 'root', password: '' });
        
        // Veritabanı yarat
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
        // Kullanıcı yarat ve yetkilendir
        await connection.query(`CREATE USER IF NOT EXISTS '${dbUser}'@'localhost' IDENTIFIED BY '${dbPass}'`);
        await connection.query(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${dbUser}'@'localhost'`);
        await connection.query('FLUSH PRIVILEGES');
        
        await connection.end();
        console.log(`Veritabanı ve kullanıcı MySQL/MariaDB üzerinde başarıyla yaratıldı: ${dbName}`);
        return true;
    } catch (err) {
        console.error('MariaDB SQL Error:', err);
        throw new Error('MariaDB işlemi başarısız. Root şifresi korumalı olabilir veya DB yüklü değil.');
    }
}

async function deleteDatabase(dbName, dbUser) {
    if (!isLinux) {
        console.log(`[MOCK] MariaDB Veritabanı silindi: ${dbName}`);
        mockDatabases = mockDatabases.filter(db => db.dbName !== dbName);
        return true;
    }
    
    try {
        const connection = await mysql.createConnection({ host: 'localhost', user: 'root', password: '' });
        
        // Veritabanını sil
        await connection.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
        // Kullanıcıyı sil
        if (dbUser) {
            await connection.query(`DROP USER IF EXISTS '${dbUser}'@'localhost'`);
        }
        
        await connection.end();
        console.log(`Veritabanı silindi: ${dbName}`);
        return true;
    } catch (err) {
        console.error('MariaDB SQL Error:', err);
        throw new Error('MariaDB veritabanı silinirken hata oluştu.');
    }
}

module.exports = {
    createDatabase,
    deleteDatabase
};
