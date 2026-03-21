const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const isLinux = process.platform === 'linux';
const BACKUP_DIR = isLinux ? '/root/appserver_backups' : path.join(__dirname, 'mock_backups');
const WEB_ROOT_BASE = isLinux ? '/var/www' : path.join(__dirname, 'mock_www');

if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

async function createArchiveBackup(domain) {
    const sourceDir = path.join(WEB_ROOT_BASE, domain);
    if (!fs.existsSync(sourceDir)) {
        throw new Error(`Website directory ${sourceDir} does not exist.`);
    }

    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `${domain}_backup_${dateStr}.tar.gz`;
    const backupFilePath = path.join(BACKUP_DIR, backupFileName);

    if (isLinux) {
        try {
            await execPromise(`tar -czf ${backupFilePath} -C ${WEB_ROOT_BASE} ${domain}`);
            return backupFileName;
        } catch (error) {
            throw new Error(`Failed to create compressed backup tarball: ${error.message}`);
        }
    } else {
        // Mock Backup
        fs.writeFileSync(backupFilePath, 'Mock Tar Archive Data');
        return backupFileName;
    }
}

function listBackups() {
    return fs.readdirSync(BACKUP_DIR).map(file => {
        const stats = fs.statSync(path.join(BACKUP_DIR, file));
        return {
            filename: file,
            size: stats.size,
            created_at: stats.mtime
        };
    });
}

function deleteBackup(filename) {
    // Güvenlik: Sadece backup klasörü içindeki dosyaları sildirmeli
    if(filename.includes('/') || filename.includes('\\')) throw new Error('Invalid filename');
    const target = path.join(BACKUP_DIR, filename);
    if (fs.existsSync(target)) {
        fs.unlinkSync(target);
    }
    return true;
}

async function restoreBackup(filename, domain) {
    if(filename.includes('/') || filename.includes('\\')) throw new Error('Invalid backup filename');
    const sourcePath = path.join(BACKUP_DIR, filename);
    const targetDir = path.join(WEB_ROOT_BASE, domain);

    if (!fs.existsSync(sourcePath)) {
        throw new Error(`Backup archive ${filename} does not exist.`);
    }

    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    if (isLinux) {
        try {
            await execPromise(`tar -xzf ${sourcePath} -C ${WEB_ROOT_BASE}`);
            return true;
        } catch (error) {
            throw new Error(`Failed to restore backup: ${error.message}`);
        }
    } else {
        console.log(`[MOCK] Restored ${filename} to ${targetDir}`);
        return true;
    }
}

module.exports = {
    createArchiveBackup,
    listBackups,
    deleteBackup,
    restoreBackup,
    BACKUP_DIR
};
