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
const serviceManager = require('./serviceManager');
const cronManager = require('./cronManager');
const mailManager = require('./mailManager');
const installerManager = require('./installerManager');
const securityManager = require('./securityManager');
const fs = require('fs');

const app = express();
const PORT_ADMIN = process.env.PORT_ADMIN || 3001;
const PORT_USER = process.env.PORT_USER || 3002;
const JWT_SECRET = 'appserver-super-secret-key-123';
const isLinux = process.platform === 'linux';

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
            
            // DNS Records
            db.run(`CREATE TABLE IF NOT EXISTS dns_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                domain TEXT NOT NULL,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                value TEXT NOT NULL,
                priority INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            
            // Cron Jobs
            db.run(`CREATE TABLE IF NOT EXISTS cron_jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                domain TEXT NOT NULL,
                minute TEXT NOT NULL,
                hour TEXT NOT NULL,
                day TEXT NOT NULL,
                month TEXT NOT NULL,
                weekday TEXT NOT NULL,
                command TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            
            // Mail Users
            db.run(`CREATE TABLE IF NOT EXISTS mail_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                domain TEXT NOT NULL,
                quota TEXT DEFAULT '1024M',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
            
            // Generate default AppServer Welcome Page on Port 80
            try {
                const defaultWebRoot = isLinux ? '/var/www/html' : path.join(__dirname, 'mock_var_www', 'html');
                if (!fs.existsSync(defaultWebRoot)) fs.mkdirSync(defaultWebRoot, { recursive: true });
                
                const indexContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>AppServer - Sunucu Aktif</title>
    <style>
        body { font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; color: #f8fafc; text-align: center; padding-top: 100px; margin: 0; }
        h1 { color: #38bdf8; font-size: 3.5rem; margin-bottom: 10px; }
        p { font-size: 1.2rem; color: #94a3b8; line-height: 1.6; }
        .summary-box { margin-top: 40px; padding: 30px; display: inline-block; text-align: left; background: rgba(30, 41, 59, 0.5); border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); border: 1px solid #1e293b; max-width: 600px; }
        .summary-box h3 { margin-top: 0; color: #38bdf8; font-size: 1.5rem; border-bottom: 1px solid #334155; padding-bottom: 10px; margin-bottom: 20px;}
        .features { display: flex; gap: 15px; flex-wrap: wrap; margin-top: 25px; }
        .features span { background: #1e293b; padding: 8px 15px; border-radius: 20px; font-size: 0.9rem; font-weight: 500; color: #bae6fd; border: 1px solid #38bdf840; }
    </style>
</head>
<body>
    <h1>Tebrikler, Sunucu Hazır! 🎉</h1>
    <p>Bu modern sunucu altyapısı başarıyla kuruldu ve yayına hazır durumda.</p>
    
    <div class="summary-box">
        <h3>AppServer V6.2 Mimkârı</h3>
        <p>Görüntülediğiniz bu sayfa, profesyonel web proje yönetimi ve barındırma ihtiyaçları için tasarlanmış <strong>AppServer Hosting Paneli</strong> tarafından otomatik oluşturulmuştur.</p>
        <p>İçerisinde hiçbir hassas sunucu bilgisi, panel erişim bağlantısı veya port adresi barındırılmaz. Daha fazla bilgi için lütfen alan adı veya sunucu yöneticisi ile iletişime geçiniz.</p>
        
        <div class="features">
            <span>🚀 Nginx Sunucusu</span>
            <span>⚡ PHP-FPM Desteği</span>
            <span>📧 Gelişmiş Webmail</span>
            <span>🔒 UFW & Fail2ban</span>
        </div>
    </div>
</body>
</html>`;
                fs.writeFileSync(path.join(defaultWebRoot, 'index.html'), indexContent);

                const defaultConfPath = isLinux ? '/etc/nginx/sites-available/default' : path.join(__dirname, 'mock_nginx', 'sites-available', 'default');
                const defaultNginxConf = `server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    root ${defaultWebRoot.replace(/\\/g, '/')};
    index index.html index.php;

    location / {
        try_files $uri $uri/ =404;
    }

    location ^~ /webmail {
        alias /var/www/webmail;
        index index.php index.html;
        location ~ \\.php$ {
            include snippets/fastcgi-php.conf;
            fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
            fastcgi_param SCRIPT_FILENAME $request_filename;
        }
    }
}`;
                // Only create the default if sites-available exists
                const sitesAvailableDir = path.dirname(defaultConfPath);
                if (!fs.existsSync(sitesAvailableDir)) fs.mkdirSync(sitesAvailableDir, { recursive: true });
                
                fs.writeFileSync(defaultConfPath, defaultNginxConf);
                
                const defaultSymlink = isLinux ? '/etc/nginx/sites-enabled/default' : path.join(__dirname, 'mock_nginx', 'sites-enabled', 'default');
                const sitesEnabledDir = path.dirname(defaultSymlink);
                if (!fs.existsSync(sitesEnabledDir)) fs.mkdirSync(sitesEnabledDir, { recursive: true });

                if (!fs.existsSync(defaultSymlink)) {
                    if (isLinux) fs.symlinkSync(defaultConfPath, defaultSymlink);
                    else fs.copyFileSync(defaultConfPath, defaultSymlink);
                }
                
                nginxManager.reloadNginx().catch(e => console.log('Nginx reload (default site) failed.'));
            } catch (err) {
                console.error('Varsayılan Nginx ayarları yüklenemedi:', err.message);
            }
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
        
        const reqPort = req.socket.localPort;
        if (reqPort === parseInt(PORT_ADMIN) && user.role === 'user') {
            return res.status(403).json({ error: 'Bu porttan (3001) sadece yönetici ve alt kullanıcılar giriş yapabilir.' });
        }
        if (reqPort === parseInt(PORT_USER) && user.role !== 'user') {
            return res.status(403).json({ error: 'Bu porttan (3002) sadece normal kullanıcılar (cPanel arayüzü) giriş yapabilir.' });
        }

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

app.post('/api/system/update', authenticate, requireRole(['admin']), (req, res) => {
    const { exec } = require('child_process');
    const updateScript = path.join(__dirname, '..', 'update.sh');
    
    exec(`bash ${updateScript}`, (error, stdout, stderr) => {
        if (error) console.error(`Güncelleme hatası: ${error}`);
    });
    
    res.json({ success: true, message: 'Güncelleme başarıyla başlatıldı, sistem yakında yeniden başlayacaktır.' });
});

app.get('/api/system/services', authenticate, requireRole(['admin']), async (req, res) => {
    try {
        const results = await serviceManager.getAllServices();
        res.json(results);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/system/services/control', authenticate, requireRole(['admin']), async (req, res) => {
    const { serviceId, action } = req.body;
    try {
        const result = await serviceManager.controlService(serviceId, action);
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/system/logs', authenticate, requireRole(['admin']), async (req, res) => {
    const { logPath, lines } = req.query;
    try {
        const logData = await serviceManager.tailLog(logPath, parseInt(lines) || 100);
        res.json({ logs: logData });
    } catch (e) { res.status(500).json({ error: e.message }); }
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

// -- DNS ZONE EDITOR ROUTES --
app.get('/api/dns/:domain', authenticate, async (req, res) => {
    const { domain } = req.params;
    db.get(`SELECT domain FROM websites WHERE domain = ? AND ${getVisibleUsersFilter(req.user)}`, [domain], async (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Domain not found or access denied' });
        const records = await dbAll('SELECT * FROM dns_records WHERE domain = ?', [domain]);
        res.json(records);
    });
});

app.post('/api/dns/:domain', authenticate, (req, res) => {
    const { domain } = req.params;
    const { name, type, value, priority } = req.body;
    db.get(`SELECT domain FROM websites WHERE domain = ? AND ${getVisibleUsersFilter(req.user)}`, [domain], async (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Domain not found' });
        try {
            const result = await dbRun('INSERT INTO dns_records (domain, name, type, value, priority) VALUES (?, ?, ?, ?, ?)', [domain, name, type, value, priority || null]);
            
            // Re-generate DNS Zone
            const allRecords = await dbAll('SELECT * FROM dns_records WHERE domain = ?', [domain]);
            const settingsRows = await dbAll('SELECT * FROM settings');
            const settings = {}; settingsRows.forEach(s => settings[s.key] = s.value);
            
            await dnsManager.createDnsZone(domain, settings.server_ip || '127.0.0.1', settings.ns1 || 'ns1', settings.ns2 || 'ns2', allRecords);
            
            res.json({ success: true, id: result.lastID });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });
});

app.delete('/api/dns/:domain/:id', authenticate, (req, res) => {
    const { domain, id } = req.params;
    db.get(`SELECT domain FROM websites WHERE domain = ? AND ${getVisibleUsersFilter(req.user)}`, [domain], async (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Domain not found' });
        try {
            await dbRun('DELETE FROM dns_records WHERE id = ? AND domain = ?', [id, domain]);
            
            // Re-generate DNS Zone
            const allRecords = await dbAll('SELECT * FROM dns_records WHERE domain = ?', [domain]);
            const settingsRows = await dbAll('SELECT * FROM settings');
            const settings = {}; settingsRows.forEach(s => settings[s.key] = s.value);
            
            await dnsManager.createDnsZone(domain, settings.server_ip || '127.0.0.1', settings.ns1 || 'ns1', settings.ns2 || 'ns2', allRecords);
            
            res.json({ deleted: true });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });
});

// -- PHP INI SETTINGS --
app.get('/api/websites/:id/php-ini', authenticate, (req, res) => {
    const { id } = req.params;
    db.get(`SELECT domain FROM websites WHERE id = ? AND ${getVisibleUsersFilter(req.user)}`, [id], async (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Website not found' });
        try {
            const settings = await phpManager.getPhpSettings(row.domain);
            res.json(settings);
        } catch (error) { res.status(500).json({ error: error.message }); }
    });
});
app.post('/api/websites/:id/php-ini', authenticate, (req, res) => {
    const { id } = req.params;
    const settings = req.body;
    db.get(`SELECT domain FROM websites WHERE id = ? AND ${getVisibleUsersFilter(req.user)}`, [id], async (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Website not found' });
        try {
            await phpManager.savePhpSettings(row.domain, settings);
            res.json({ success: true });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });
});

// -- CRON JOBS ROUTE --
app.get('/api/cron', authenticate, async (req, res) => {
    const filter = req.user.role === 'admin' ? '1=1' : `domain IN (SELECT domain FROM websites WHERE ${getVisibleUsersFilter(req.user)})`;
    try {
        const rows = await dbAll(`SELECT * FROM cron_jobs WHERE ${filter}`);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/cron', authenticate, async (req, res) => {
    const { domain, minute, hour, day, month, weekday, command } = req.body;
    db.get(`SELECT domain FROM websites WHERE domain = ? AND ${getVisibleUsersFilter(req.user)}`, [domain], async (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Domain not found' });
        try {
            await dbRun('INSERT INTO cron_jobs (domain, minute, hour, day, month, weekday, command) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [domain, minute, hour, day, month, weekday, command]);
            const allCrons = await dbAll('SELECT * FROM cron_jobs');
            await cronManager.regenerateCrons(allCrons);
            res.json({ success: true });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });
});

app.delete('/api/cron/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    const filter = req.user.role === 'admin' ? '1=1' : `domain IN (SELECT domain FROM websites WHERE ${getVisibleUsersFilter(req.user)})`;
    db.get(`SELECT * FROM cron_jobs WHERE id = ? AND ${filter}`, [id], async (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Cron not found' });
        try {
            await dbRun('DELETE FROM cron_jobs WHERE id = ?', [id]);
            const allCrons = await dbAll('SELECT * FROM cron_jobs');
            await cronManager.regenerateCrons(allCrons);
            res.json({ deleted: true });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });
});

// -- EMAIL ACCOUNTS --
app.get('/api/mail', authenticate, async (req, res) => {
    const filter = req.user.role === 'admin' ? '1=1' : `domain IN (SELECT domain FROM websites WHERE ${getVisibleUsersFilter(req.user)})`;
    try {
        const rows = await dbAll(`SELECT id, username, domain, quota, created_at FROM mail_users WHERE ${filter}`);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/mail', authenticate, async (req, res) => {
    const { username, domain, password, quota } = req.body;
    const fullEmail = `${username}@${domain}`;
    db.get(`SELECT domain FROM websites WHERE domain = ? AND ${getVisibleUsersFilter(req.user)}`, [domain], async (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Domain not found' });
        try {
            const hash = await bcrypt.hash(password, 10);
            await dbRun('INSERT INTO mail_users (username, password_hash, domain, quota) VALUES (?, ?, ?, ?)',
                [fullEmail, hash, domain, quota || '1024M']);
            const allAccounts = await dbAll('SELECT username FROM mail_users');
            await mailManager.rebuildPostfixMaps(allAccounts);
            res.json({ success: true });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });
});

app.delete('/api/mail/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    const filter = req.user.role === 'admin' ? '1=1' : `domain IN (SELECT domain FROM websites WHERE ${getVisibleUsersFilter(req.user)})`;
    db.get(`SELECT * FROM mail_users WHERE id = ? AND ${filter}`, [id], async (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Mail account not found' });
        try {
            await dbRun('DELETE FROM mail_users WHERE id = ?', [id]);
            const allAccounts = await dbAll('SELECT username FROM mail_users');
            await mailManager.rebuildPostfixMaps(allAccounts);
            res.json({ deleted: true });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });
});

// -- 1-CLICK APP INSTALLER --
app.post('/api/installer/:app', authenticate, async (req, res) => {
    const { domain } = req.body;
    const { app: appName } = req.params;
    db.get(`SELECT domain FROM websites WHERE domain = ? AND ${getVisibleUsersFilter(req.user)}`, [domain], async (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Domain not found or access denied' });
        try {
            if (appName === 'wordpress') {
                await installerManager.installWordpress(row.domain);
            } else if (appName === 'laravel') {
                await installerManager.installLaravel(row.domain);
            } else {
                return res.status(400).json({ error: 'Softaculous Error: Unsupported Application' });
            }
            res.json({ success: true, message: `${appName.toUpperCase()} installed successfully on ${row.domain}.` });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });
});

// -- SECURITY CENTER (UFW & FAIL2BAN) --
app.get('/api/security/firewall', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Root Access Required' });
    try { const status = await securityManager.getFirewallStatus(); res.json({ status }); } 
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/security/firewall', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Root Access Required' });
    const { op, port, protocol, ruleNum } = req.body;
    try {
        let msg = '';
        if (op === 'enable') msg = await securityManager.enableFirewall();
        else if (op === 'disable') msg = await securityManager.disableFirewall();
        else if (op === 'add') msg = await securityManager.addFirewallRule('allow', port, protocol);
        else if (op === 'delete') msg = await securityManager.deleteFirewallRule(ruleNum);
        res.json({ success: true, message: msg });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/security/fail2ban', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Root Access Required' });
    try {
        const status = await securityManager.getFail2BanStatus();
        const sshd = await securityManager.getFail2BanJailStatus('sshd');
        res.json({ status, sshd });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/security/fail2ban', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Root Access Required' });
    const { op, jail, ip } = req.body;
    try {
        let msg = '';
        if (op === 'ban') msg = await securityManager.banIp(jail || 'sshd', ip);
        else if (op === 'unban') msg = await securityManager.unbanIp(jail || 'sshd', ip);
        res.json({ success: true, message: msg });
    } catch (e) { res.status(500).json({ error: e.message }); }
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

// Start servers on ports
app.listen(PORT_ADMIN, () => {
    console.log(`[AppServer V6.1] Yonetici/Alt Kullanici Paneli (WHM): http://localhost:${PORT_ADMIN}`);
});

app.listen(PORT_USER, () => {
    console.log(`[AppServer V6.1] Normal Kullanici Paneli (cPanel)  : http://localhost:${PORT_USER}`);
});
