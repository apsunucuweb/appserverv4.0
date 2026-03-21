const fs = require('fs');
const path = require('path');

const isLinux = process.platform === 'linux';
const WEB_ROOT_BASE = isLinux ? '/var/www' : path.join(__dirname, 'mock_www');

function getSafePath(domain, relativePath) {
    const rootPath = path.join(WEB_ROOT_BASE, domain);
    const targetPath = path.normalize(path.join(rootPath, relativePath || ''));
    
    // Güvenlik: Dizin dışına çıkılmasını (Path Traversal: ../../) engelle
    if (!targetPath.startsWith(rootPath)) {
        throw new Error('Access denied: Unauthorized path traversal detected.');
    }
    return targetPath;
}

const listDirectory = (domain, relativePath = '') => {
    const targetPath = getSafePath(domain, relativePath);
    if (!fs.existsSync(targetPath)) throw new Error('Directory not found');
    
    const items = fs.readdirSync(targetPath);
    return items.map(item => {
        const fullPath = path.join(targetPath, item);
        const stats = fs.statSync(fullPath);
        return {
            name: item,
            isDirectory: stats.isDirectory(),
            size: stats.size,
            mtime: stats.mtime
        };
    });
};

const readFileContent = (domain, relativePath) => {
    const targetPath = getSafePath(domain, relativePath);
    if (!fs.existsSync(targetPath)) throw new Error('File not found');
    const stats = fs.statSync(targetPath);
    if (stats.size > 5 * 1024 * 1024) throw new Error('File too large to read in browser (Max 5MB)');
    
    return fs.readFileSync(targetPath, 'utf8');
};

const writeFileContent = (domain, relativePath, content) => {
    const targetPath = getSafePath(domain, relativePath);
    fs.writeFileSync(targetPath, content, 'utf8');
    return true;
};

const deleteItem = (domain, relativePath) => {
    const targetPath = getSafePath(domain, relativePath);
    if (!fs.existsSync(targetPath)) throw new Error('Item not found');
    const stats = fs.statSync(targetPath);
    if (stats.isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
        fs.unlinkSync(targetPath);
    }
    return true;
};

const createFolder = (domain, relativePath, folderName) => {
    const targetPath = getSafePath(domain, path.join(relativePath, folderName));
    if (fs.existsSync(targetPath)) throw new Error('Folder already exists');
    fs.mkdirSync(targetPath, { recursive: true });
    return true;
};

module.exports = {
    listDirectory,
    readFileContent,
    writeFileContent,
    deleteItem,
    createFolder
};
