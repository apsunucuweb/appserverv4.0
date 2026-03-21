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
        
        // Try creating default DNS Zone pointing to server IP
        const serverIp = '89.252.139.124'; // Server IP (Can be dynamic in future)
        try { await dnsManager.createDnsZone(domain, serverIp); } catch (e) { console.error('DNS Warning:', e.message); }

        const result = await dbRun('INSERT INTO websites (user_id, domain) VALUES (?, ?)', [req.user.id, domain]);
        res.json({ id: result.lastID, domain, status: 'active', php_version: '8.1' });
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
