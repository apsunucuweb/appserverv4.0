const express = require('express');
const cors = require('cors');
const si = require('systeminformation');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const nginxManager = require('./nginxManager');
const dbManager = require('./dbManager');
const sslManager = require('./sslManager');
const ftpManager = require('./ftpManager');
const dnsManager = require('./dnsManager');
const phpManager = require('./phpManager');
const fileManager = require('./fileManager');
const backupManager = require('./backupManager');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = 'appserver-super-secret-key-123';

// Middleware
app.use(cors());
app.use(express.json());

// Database setup
const dbPath = path.join(__dirname, 'appserver.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        db.serialize(() => {
            // Packages
            db.run(`CREATE TABLE IF NOT EXISTS packages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                max_websites INTEGER DEFAULT 1,
                max_databases INTEGER DEFAULT 1,
                max_ftp_users INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            
            // Users
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT CHECK(role IN ('admin', 'reseller', 'user')) DEFAULT 'user',
                parent_id INTEGER DEFAULT NULL,
                package_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(parent_id) REFERENCES users(id),
                FOREIGN KEY(package_id) REFERENCES packages(id)
            )`, () => {
                // Create admin if not exists
                db.get(`SELECT id FROM users WHERE username = 'admin'`, async (err, row) => {
                    if (!row) {
                        const hash = await bcrypt.hash('admin123', 10);
                        db.run(`INSERT INTO users (username, password_hash, role) VALUES ('admin', ?, 'admin')`, [hash]);
                        console.log('Default admin created: admin / admin123');
                    }
                });
            });

            // Resources tied to users
            db.run(`CREATE TABLE IF NOT EXISTS websites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                domain TEXT NOT NULL UNIQUE,
                status TEXT DEFAULT 'active',
                has_ssl INTEGER DEFAULT 0,
                php_version TEXT DEFAULT '8.1',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS databases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                db_name TEXT NOT NULL UNIQUE,
                db_user TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS ftp_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                username TEXT NOT NULL UNIQUE,
                domain TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )`);

            // Settings
            db.run(`CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )`, () => {
                const defaults = [
                    { key: 'ns1', value: 'ns1.appserver.local' },
                    { key: 'ns2', value: 'ns2.appserver.local' },
                    { key: 'server_ip', value: '127.0.0.1' }
                ];
                db.get("SELECT count(*) as count FROM settings", (err, row) => {
                    if (row && row.count === 0) {
                        const stmt = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
                        defaults.forEach(d => stmt.run(d.key, d.value));
                        stmt.finalize();
                    }
                });
            });
        });
    }
});

// Async DB Wrapper
const dbAll = (query, params = []) => new Promise((res, rej) => db.all(query, params, (err, rows) => err ? rej(err) : res(rows)));
const dbRun = (query, params = []) => new Promise((res, rej) => db.run(query, params, function(err) { err ? rej(err) : res(this) }));

// Auth Middleware
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized: No token' });
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: 'Unauthorized: Invalid token' });
        req.user = decoded; 
        next();
    });
};
const requireRole = (roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'Access denied' });
    next();
};

const getVisibleUsersFilter = (user) => {
    if (user.role === 'admin') return '1=1'; // See all
    if (user.role === 'reseller') return `user_id IN (SELECT id FROM users WHERE parent_id = ${user.id} OR id = ${user.id})`;
    return `user_id = ${user.id}`;
};

// -- AUTH ROUTES --
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err || !user) return res.status(401).json({ error: 'Invalid credentials' });
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    });
});

// -- SETTINGS ROUTES --
app.get('/api/settings', authenticate, async (req, res) => {
    try {
        const rows = await dbAll('SELECT * FROM settings');
        const settings = {};
        rows.forEach(r => settings[r.key] = r.value);
        res.json(settings);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/settings', authenticate, requireRole(['admin']), async (req, res) => {
    try {
        const updates = req.body; // { ns1: '...', ns2: '...', server_ip: '...' }
        const stmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
        for (const [key, value] of Object.entries(updates)) {
            stmt.run(key, value);
        }
        stmt.finalize();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// -- SYSTEM ROUTE --
app.get('/api/system', authenticate, async (req, res) => {
    try {
        const cpu = await si.currentLoad();
        const mem = await si.mem();
        const os = await si.osInfo();
        res.json({
            cpu: cpu.currentLoad.toFixed(2),
            memTotal: (mem.total / 1024 / 1024 / 1024).toFixed(2),
            memUsed: (mem.active / 1024 / 1024 / 1024).toFixed(2),
            os: os.distro,
            uptime: si.time().uptime
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// -- USERS & PACKAGES ROUTES --
app.get('/api/packages', authenticate, requireRole(['admin']), async (req, res) => {
    try {
        const pkgs = await dbAll(`SELECT * FROM packages`);
        res.json(pkgs);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/packages', authenticate, requireRole(['admin']), async (req, res) => {
    const { name, max_websites, max_databases, max_ftp_users } = req.body;
    try {
        const result = await dbRun('INSERT INTO packages (name, max_websites, max_databases, max_ftp_users) VALUES (?, ?, ?, ?)', 
            [name, max_websites || 1, max_databases || 1, max_ftp_users || 1]);
        res.json({ id: result.lastID, name });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/packages/:id', authenticate, requireRole(['admin']), async (req, res) => {
    try {
        await dbRun('DELETE FROM packages WHERE id = ?', [req.params.id]);
        res.json({ deleted: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/users', authenticate, requireRole(['admin', 'reseller']), async (req, res) => {
    const filter = req.user.role === 'admin' ? '' : `WHERE parent_id = ${req.user.id}`;
    const users = await dbAll(`SELECT id, username, role, parent_id, package_id, created_at FROM users ${filter}`);
    res.json(users);
});

app.post('/api/users', authenticate, requireRole(['admin', 'reseller']), async (req, res) => {
    const { username, password, role, package_id } = req.body;
    if (role === 'admin' && req.user.role !== 'admin') return res.status(403).json({ error: 'Only admins can create admins' });
    if (role === 'reseller' && req.user.role !== 'admin') return res.status(403).json({ error: 'Only admins can create resellers' });
    
    try {
        const hash = await bcrypt.hash(password, 10);
        const result = await dbRun('INSERT INTO users (username, password_hash, role, parent_id, package_id) VALUES (?, ?, ?, ?, ?)', 
            [username, hash, role, req.user.id, package_id || null]);
        res.json({ id: result.lastID, username, role });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/users/:id', authenticate, requireRole(['admin', 'reseller']), async (req, res) => {
    const { id } = req.params;
    try {
        // Ensure resellers can only delete their own sub-users
        const filter = req.user.role === 'admin' ? '' : `AND parent_id = ${req.user.id}`;
        const result = await dbRun(`DELETE FROM users WHERE id = ? ${filter}`, [id]);
        if (result.changes === 0) return res.status(403).json({ error: 'Not authorized or user not found' });
        res.json({ deleted: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -- RESOURCE ROUTES --
app.get('/api/websites', authenticate, async (req, res) => {
    const rows = await dbAll(`SELECT * FROM websites WHERE ${getVisibleUsersFilter(req.user)}`);
    res.json(rows);
});

app.post('/api/websites', authenticate, async (req, res) => {
    const { domain } = req.body;
    try {
        await nginxManager.createVhost(domain);
        
        let serverIp = '127.0.0.1';
        let ns1 = 'ns1.localhost';
        let ns2 = 'ns2.localhost';
        
        try {
            const settingsRows = await dbAll('SELECT * FROM settings');
            const settings = {};
            settingsRows.forEach(r => settings[r.key] = r.value);
            if (settings.server_ip) serverIp = settings.server_ip;
            if (settings.ns1) ns1 = settings.ns1;
            if (settings.ns2) ns2 = settings.ns2;
        } catch (e) {
            console.error('Failed to load settings:', e.message);
        }

        let dnsWarning = null;
        try { 
            await dnsManager.createDnsZone(domain, serverIp, ns1, ns2); 
        } catch (e) { 
            console.error('DNS Warning:', e.message); 
            dnsWarning = e.message;
        }

        const result = await dbRun('INSERT INTO websites (user_id, domain) VALUES (?, ?)', [req.user.id, domain]);
        
        try {
            await phpManager.changePhpVersion(domain, '8.1');
        } catch (e) {
            console.error('PHP Setup Warning:', e.message);
        }

        res.json({ id: result.lastID, domain, status: 'active', php_version: '8.1', dns_warning: dnsWarning });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/websites/:id', authenticate, (req, res) => {
    const { id } = req.params;
    db.get(`SELECT domain FROM websites WHERE id = ? AND ${getVisibleUsersFilter(req.user)}`, [id], async (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Website not found or access denied' });
        try {
            await nginxManager.deleteVhost(row.domain);
            try { await dnsManager.deleteDnsZone(row.domain); } catch (e) { console.error('DNS Warning:', e.message); }
            await dbRun('DELETE FROM websites WHERE id = ?', [id]);
            res.json({ deleted: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
});

app.post('/api/websites/:id/php', authenticate, (req, res) => {
    const { id } = req.params;
    const { version } = req.body;
    db.get(`SELECT domain FROM websites WHERE id = ? AND ${getVisibleUsersFilter(req.user)}`, [id], async (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Website not found' });
        try {
            await phpManager.changePhpVersion(row.domain, version);
            await dbRun('UPDATE websites SET php_version = ? WHERE id = ?', [version, id]);
            res.json({ success: true, version });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
});

app.post('/api/websites/:id/ssl', authenticate, (req, res) => {
    const { id } = req.params;
    db.get(`SELECT domain FROM websites WHERE id = ? AND ${getVisibleUsersFilter(req.user)}`, [id], async (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Website not found' });
        try {
            await sslManager.installSSL(row.domain);
            await dbRun('UPDATE websites SET has_ssl = 1 WHERE id = ?', [id]);
            res.json({ success: true, domain: row.domain });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
});

app.get('/api/databases', authenticate, async (req, res) => {
    const rows = await dbAll(`SELECT * FROM databases WHERE ${getVisibleUsersFilter(req.user)}`);
    res.json(rows);
});

app.post('/api/databases', authenticate, async (req, res) => {
    const { dbName, dbUser, dbPass } = req.body;
    try {
        await dbManager.createDatabase(dbName, dbUser, dbPass);
        const result = await dbRun('INSERT INTO databases (user_id, db_name, db_user) VALUES (?, ?, ?)', [req.user.id, dbName, dbUser]);
        res.json({ id: result.lastID, dbName, dbUser });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/databases/:id', authenticate, (req, res) => {
    const { id } = req.params;
    db.get(`SELECT db_name, db_user FROM databases WHERE id = ? AND ${getVisibleUsersFilter(req.user)}`, [id], async (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'DB not found' });
        try {
            await dbManager.deleteDatabase(row.db_name, row.db_user);
            await dbRun('DELETE FROM databases WHERE id = ?', [id]);
            res.json({ deleted: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
});

app.get('/api/ftp', authenticate, async (req, res) => {
    const rows = await dbAll(`SELECT * FROM ftp_users WHERE ${getVisibleUsersFilter(req.user)}`);
    res.json(rows);
});

app.post('/api/ftp', authenticate, async (req, res) => {
    const { username, password, domain } = req.body;
    try {
        await ftpManager.createFtpUser(username, password, domain);
        const result = await dbRun('INSERT INTO ftp_users (user_id, username, domain) VALUES (?, ?, ?)', [req.user.id, username, domain]);
        res.json({ id: result.lastID, username, domain });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/ftp/:id', authenticate, (req, res) => {
    const { id } = req.params;
    db.get(`SELECT username FROM ftp_users WHERE id = ? AND ${getVisibleUsersFilter(req.user)}`, [id], async (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'FTP user not found' });
        try {
            await ftpManager.deleteFtpUser(row.username);
            await dbRun('DELETE FROM ftp_users WHERE id = ?', [id]);
            res.json({ deleted: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
});

// -- APPSERVER V6.0 ENDPOINTS (File Manager, Backups, PMA) --

app.get('/api/websites/:id/files', authenticate, (req, res) => {
    const { id } = req.params;
    const { dirPath } = req.query; // e.g. "public_html/css"
    db.get(`SELECT domain FROM websites WHERE id = ? AND ${getVisibleUsersFilter(req.user)}`, [id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Website not found' });
        try {
            const items = fileManager.listDirectory(row.domain, dirPath || 'public_html');
            res.json(items);
        } catch (error) { res.status(500).json({ error: error.message }); }
    });
});

app.post('/api/websites/:id/files', authenticate, (req, res) => {
    const { id } = req.params;
    const { parentPath, newFolderName, newFileName, fileContent } = req.body;
    db.get(`SELECT domain FROM websites WHERE id = ? AND ${getVisibleUsersFilter(req.user)}`, [id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Website not found' });
        try {
            if (newFolderName) fileManager.createFolder(row.domain, parentPath, newFolderName);
            if (newFileName) fileManager.writeFileContent(row.domain, path.join(parentPath, newFileName), fileContent);
            res.json({ success: true });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });
});

app.post('/api/websites/:id/files/delete', authenticate, (req, res) => {
    const { id } = req.params;
    const { targetPath } = req.body;
    db.get(`SELECT domain FROM websites WHERE id = ? AND ${getVisibleUsersFilter(req.user)}`, [id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Website not found' });
        try {
            fileManager.deleteItem(row.domain, targetPath);
            res.json({ success: true });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });
});

app.post('/api/websites/:id/backup', authenticate, (req, res) => {
    const { id } = req.params;
    db.get(`SELECT domain FROM websites WHERE id = ? AND ${getVisibleUsersFilter(req.user)}`, [id], async (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Website not found' });
        try {
            const archiveName = await backupManager.createArchiveBackup(row.domain);
            res.json({ success: true, archiveName });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });
});

app.get('/api/backups', authenticate, requireRole(['admin']), (req, res) => {
    try {
        const backups = backupManager.listBackups();
        res.json(backups);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/backups/:filename', authenticate, requireRole(['admin']), (req, res) => {
    try {
        backupManager.deleteBackup(req.params.filename);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/backups/restore', authenticate, requireRole(['admin']), async (req, res) => {
    const { filename, domain } = req.body;
    try {
        await backupManager.restoreBackup(filename, domain);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/websites/:id/pma', authenticate, (req, res) => {
    const { id } = req.params;
    db.get(`SELECT domain FROM websites WHERE id = ? AND ${getVisibleUsersFilter(req.user)}`, [id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Website not found' });
        try {
            const isLinux = process.platform === 'linux';
            const webRoot = isLinux ? `/var/www/${row.domain}/public_html/pma` : path.join(__dirname, 'mock_www', row.domain, 'public_html', 'pma');
            const pmaSource = isLinux ? '/usr/share/phpmyadmin' : path.join(__dirname, 'mock_pma');

            if (!fs.existsSync(pmaSource) && !isLinux) fs.mkdirSync(pmaSource, { recursive: true });

            if (fs.existsSync(webRoot)) return res.json({ success: true, url: `http://${row.domain}/pma` });

            fs.symlinkSync(pmaSource, webRoot, 'dir');
            res.json({ success: true, url: `http://${row.domain}/pma` });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });
});

// Serve Frontend Static Files
const frontendDistPath = path.join(__dirname, '../appserver-frontend/dist');
app.use(express.static(frontendDistPath));

app.use((req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`AppServer Backend running on http://localhost:${PORT}`);
});
