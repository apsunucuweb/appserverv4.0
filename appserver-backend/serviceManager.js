const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs');

const isLinux = process.platform === 'linux';

// Common services to monitor and manage
const SERVICES = [
    { id: 'nginx', name: 'Nginx Web Server' },
    { id: 'mysql', name: 'MySQL / MariaDB' },
    { id: 'php8.1-fpm', name: 'PHP-FPM 8.1' },
    { id: 'vsftpd', name: 'VSFTPD Server' },
    { id: 'appserver', name: 'AppServer Core' }
];

async function getServiceStatus(serviceId) {
    if (!isLinux) {
        return { id: serviceId, status: 'active', raw: 'active (running) - Dev Mode Mock' };
    }
    try {
        const { stdout } = await execPromise(`systemctl is-active ${serviceId}`);
        return { id: serviceId, status: stdout.trim(), raw: stdout.trim() };
    } catch (err) {
        // systemctl is-active returns non-zero if inactive
        return { id: serviceId, status: 'inactive', raw: err.message.split('\n')[0] };
    }
}

async function getAllServices() {
    const results = [];
    for (const service of SERVICES) {
        const status = await getServiceStatus(service.id);
        results.push({ ...service, ...status });
    }
    return results;
}

async function controlService(serviceId, action) {
    if (!isLinux) return { success: true, message: `[MOCK] ${serviceId} ${action} ok.` };
    
    if (!['start', 'stop', 'restart', 'reload'].includes(action)) {
        throw new Error('Geçersiz işlem (action)');
    }
    
    const allowedServices = SERVICES.map(s => s.id);
    if (!allowedServices.includes(serviceId)) {
        throw new Error('Bu servisi kontrol etme yetkiniz yok.');
    }

    try {
        await execPromise(`systemctl ${action} ${serviceId}`);
        return { success: true, message: `${serviceId} servisi başarıyla ${action} edildi.` };
    } catch (err) {
        throw new Error(`${serviceId} ${action} işlemi başarısız: ${err.message}`);
    }
}

async function tailLog(logPath, lines = 100) {
    if (!isLinux) return `[MOCK LOGS for ${logPath}]\nSatır 1: Başarıyla başlatıldı...\nSatır 2: Dinleniyor...`;
    
    // Güvenlik: Sadece /var/log altındaki dosyalara izin ver.
    if (!logPath.startsWith('/var/log/')) {
        throw new Error('Sadece /var/log dizinindeki loglar okunabilir.');
    }
    
    if (!fs.existsSync(logPath)) {
        throw new Error('Log dosyası bulunamadı: ' + logPath);
    }
    
    try {
        // child_process exec ile tail komutu çalıştırıyoruz
        const { stdout } = await execPromise(`tail -n ${lines} ${logPath}`);
        return stdout;
    } catch (err) {
        throw new Error(`Log okuma hatası: ${err.message}`);
    }
}

module.exports = {
    SERVICES,
    getServiceStatus,
    getAllServices,
    controlService,
    tailLog
};
