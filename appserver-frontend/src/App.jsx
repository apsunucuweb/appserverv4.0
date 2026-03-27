import { useState, useEffect } from 'react';
import axios from 'axios';
import { LayoutDashboard, Globe, Database, Settings, Server, Cpu, HardDrive, Plus, Trash2, ShieldCheck, FolderSync, Users, Package, LogOut, Loader2, Code, Network, Archive, FileIcon, Folder, Upload, ServerCog, CloudDownload, Clock, Sliders, Mail, PackageSearch } from 'lucide-react';

const API_BASE = '/api';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [currentUser, setCurrentUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [systemInfo, setSystemInfo] = useState(null);
  
  // PHP INI Settings
  const [phpIniDomain, setPhpIniDomain] = useState('');
  const [phpIniSettings, setPhpIniSettings] = useState({ memory_limit: '', upload_max_filesize: '', post_max_size: '', max_execution_time: '' });

  // Cron Jobs
  const [cronsList, setCronsList] = useState([]);
  const [newCronDomain, setNewCronDomain] = useState('');
  const [cronMin, setCronMin] = useState('*');
  const [cronHour, setCronHour] = useState('*');
  const [cronDay, setCronDay] = useState('*');
  const [cronMonth, setCronMonth] = useState('*');
  const [cronWeekday, setCronWeekday] = useState('*');
  const [cronCmd, setCronCmd] = useState('');

  // Mail Accounts
  const [mailAccounts, setMailAccounts] = useState([]);
  const [newMailUser, setNewMailUser] = useState('');
  const [newMailDomain, setNewMailDomain] = useState('');
  const [newMailPass, setNewMailPass] = useState('');
  const [newMailQuota, setNewMailQuota] = useState('1024M');

  // Installer
  const [installerDomain, setInstallerDomain] = useState('');
  const [installerStatus, setInstallerStatus] = useState('');

  // Security Center
  const [firewallStatus, setFirewallStatus] = useState('');
  const [fail2banStatus, setFail2banStatus] = useState({ status: '', sshd: '' });
  const [fwPort, setFwPort] = useState('');
  const [fwProtocol, setFwProtocol] = useState('tcp');
  const [fwRuleNum, setFwRuleNum] = useState('');
  const [f2bIp, setF2bIp] = useState('');
  const [f2bJail, setF2bJail] = useState('sshd');

  // Services & Logs
  const [serverServices, setServerServices] = useState([]);
  const [logPath, setLogPath] = useState('/var/log/nginx/error.log');
  const [logData, setLogData] = useState('');

  // DNS Zone Editor
  const [selectedDnsDomain, setSelectedDnsDomain] = useState(null);
  const [dnsRecords, setDnsRecords] = useState([]);
  const [newDnsName, setNewDnsName] = useState('');
  const [newDnsType, setNewDnsType] = useState('A');
  const [newDnsValue, setNewDnsValue] = useState('');
  const [newDnsPriority, setNewDnsPriority] = useState('');

  // Auth States
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Resources
  const [websites, setWebsites] = useState([]);
  const [newDomain, setNewDomain] = useState('');
  const [databases, setDatabases] = useState([]);
  const [newDbName, setNewDbName] = useState('');
  const [newDbUser, setNewDbUser] = useState('');
  const [newDbPass, setNewDbPass] = useState('');
  const [ftpUsers, setFtpUsers] = useState([]);
  const [newFtpUser, setNewFtpUser] = useState('');
  const [newFtpPass, setNewFtpPass] = useState('');
  const [newFtpDomain, setNewFtpDomain] = useState('');
  
  // Backups & File Manager
  const [backupsList, setBackupsList] = useState([]);
  
  const [fmWebsiteId, setFmWebsiteId] = useState('');
  const [fmPath, setFmPath] = useState('public_html');
  const [fmItems, setFmItems] = useState([]);
  const [fmNewFolder, setFmNewFolder] = useState('');

  // Users & Packages
  const [usersList, setUsersList] = useState([]);
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [selectedPackage, setSelectedPackage] = useState('');

  // Settings
  const [serverSettings, setServerSettings] = useState({ ns1: '', ns2: '', server_ip: '' });

  const [packagesList, setPackagesList] = useState([]);
  const [newPkgName, setNewPkgName] = useState('');
  const [newPkgWebs, setNewPkgWebs] = useState(1);
  const [newPkgDbs, setNewPkgDbs] = useState(1);
  const [newPkgFtps, setNewPkgFtps] = useState(1);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchAllData();
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');
    try {
      const { data } = await axios.post(`${API_BASE}/auth/login`, { username: loginUser, password: loginPass });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.token);
      setCurrentUser(data.user);
    } catch (err) {
      setLoginError('Invalid Username or Password');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setCurrentUser(null);
  };

  const fetchAllData = () => {
    if (currentUser?.role === 'admin') { fetchSystemInfo(); fetchBackups(); fetchSettings(); fetchServices(); fetchSecurityData(); }
    fetchWebsites();
    fetchDatabases();
    fetchFtpUsers();
    fetchCrons();
    fetchMailAccounts();
    if (currentUser?.role === 'admin' || currentUser?.role === 'reseller') {
      fetchUsersList();
      fetchPackagesList();
    }
  };

  const fetchSecurityData = async () => {
      if(currentUser?.role !== 'admin') return;
      try { 
          const { data: fw } = await axios.get(`${API_BASE}/security/firewall`); 
          setFirewallStatus(fw.status); 
          const { data: f2b } = await axios.get(`${API_BASE}/security/fail2ban`);
          setFail2banStatus({ status: f2b.status, sshd: f2b.sshd });
      } catch (e) { }
  };

  const fetchSystemInfo = async () => { try { const { data } = await axios.get(`${API_BASE}/system`); setSystemInfo(data); } catch (e) { } };
  const fetchWebsites = async () => { try { const { data } = await axios.get(`${API_BASE}/websites`); setWebsites(data); } catch (e) { } };
  const fetchDatabases = async () => { try { const { data } = await axios.get(`${API_BASE}/databases`); setDatabases(data); } catch (e) { } };
  const fetchFtpUsers = async () => { try { const { data } = await axios.get(`${API_BASE}/ftp`); setFtpUsers(data); } catch (e) { } };
  const fetchCrons = async () => { try { const { data } = await axios.get(`${API_BASE}/cron`); setCronsList(data); } catch (e) { } };
  const fetchMailAccounts = async () => { try { const { data } = await axios.get(`${API_BASE}/mail`); setMailAccounts(data); } catch (e) { } };
  const fetchUsersList = async () => { try { const { data } = await axios.get(`${API_BASE}/users`); setUsersList(data); } catch (e) { } };
  const fetchPackagesList = async () => { try { const { data } = await axios.get(`${API_BASE}/packages`); setPackagesList(data); } catch (e) { } };
  const fetchBackups = async () => { try { const { data } = await axios.get(`${API_BASE}/backups`); setBackupsList(data); } catch (e) { } };
  const fetchSettings = async () => { try { const { data } = await axios.get(`${API_BASE}/settings`); setServerSettings(data); } catch (e) { } };
  const fetchServices = async () => { try { const { data } = await axios.get(`${API_BASE}/system/services`); setServerServices(data); } catch (e) { } };
  const fetchLogs = async () => { try { const { data } = await axios.get(`${API_BASE}/system/logs?logPath=${encodeURIComponent(logPath)}&lines=100`); setLogData(data.logs); } catch (e) { alert('Log Hatası: '+ (e.response?.data?.error || e.message)); } };

  const controlService = async (serviceId, action) => {
      try {
          await axios.post(`${API_BASE}/system/services/control`, { serviceId, action });
          alert(`${serviceId} ${action} tetiklendi.`);
          fetchServices();
      } catch (err) { alert('Servis Hatası: ' + (err.response?.data?.error || err.message)); }
  };

  const loadFileManager = async (siteId, overridePath) => {
    if(!siteId) return;
    try {
      const p = overridePath || fmPath;
      const { data } = await axios.get(`${API_BASE}/websites/${siteId}/files?dirPath=${encodeURIComponent(p)}`);
      setFmItems(data);
      setFmWebsiteId(siteId);
      setFmPath(p);
    } catch (err) { alert('FM Error: ' + (err.response?.data?.error || err.message)); }
  };

  const handleFmCreateFolder = async (e) => {
    e.preventDefault();
    if(!fmWebsiteId || !fmNewFolder) return;
    try {
      await axios.post(`${API_BASE}/websites/${fmWebsiteId}/files`, { parentPath: fmPath, newFolderName: fmNewFolder });
      setFmNewFolder('');
      loadFileManager(fmWebsiteId, fmPath);
    } catch (err) { alert('HATA: ' + (err.response?.data?.error || err.message)); }
  };

  const handleFmDelete = async (itemName) => {
    if(!fmWebsiteId) return;
    try {
      await axios.post(`${API_BASE}/websites/${fmWebsiteId}/files/delete`, { targetPath: fmPath + '/' + itemName });
      loadFileManager(fmWebsiteId, fmPath);
    } catch (err) { alert('HATA: ' + (err.response?.data?.error || err.message)); }
  };

  const handleCreateBackup = async (id) => {
    try { alert('Arsivleme (tar.gz) baslatiliyor. Lutfen bekleyin...'); await axios.post(`${API_BASE}/websites/${id}/backup`); alert('Backup tamamlandi!'); fetchBackups(); } 
    catch (err) { alert('HATA: ' + (err.response?.data?.error || err.message)); }
  };

  const handleDeleteBackup = async (filename) => {
    if(!confirm(`Emin misiniz? ${filename} silinecek.`)) return;
    try { await axios.delete(`${API_BASE}/backups/${filename}`); fetchBackups(); } 
    catch (err) { alert('HATA: ' + (err.response?.data?.error || err.message)); }
  };

  const handleRestoreBackup = async (filename) => {
    const domain = filename.split('_backup_')[0];
    if(!confirm(`${filename} arşivi ${domain} isimli sitenin üzerine yazılacak. Onaylıyor musunuz?`)) return;
    try { alert('Arşiv geri yükleniyor, lütfen bekleyin...'); await axios.post(`${API_BASE}/backups/restore`, { filename, domain }); alert('Geri yükleme tamamlandı!'); } 
    catch (err) { alert('HATA: ' + (err.response?.data?.error || err.message)); }
  };

  const handleInstallPma = async (id) => {
    try { const { data } = await axios.post(`${API_BASE}/websites/${id}/pma`); window.open(data.url, '_blank'); } 
    catch (err) { alert('HATA: ' + (err.response?.data?.error || err.message)); }
  };

  const handleAddWebsite = async (e) => {
    e.preventDefault();
    if (!newDomain) return;
    try { await axios.post(`${API_BASE}/websites`, { domain: newDomain }); setNewDomain(''); fetchWebsites(); } 
    catch (err) { alert('HATA: ' + (err.response?.data?.error || err.message)); }
  };
  const handleDeleteWebsite = async (id) => {
    try { await axios.delete(`${API_BASE}/websites/${id}`); fetchWebsites(); } 
    catch (err) { alert('HATA: ' + (err.response?.data?.error || err.message)); }
  };
  const handleInstallSSL = async (id) => {
    try { alert('SSL Kurulumu Certbot uzerinden basladi, lutfen bekleyin...'); await axios.post(`${API_BASE}/websites/${id}/ssl`); alert('SSL Basariyla Kuruldu!'); fetchWebsites(); } 
    catch (err) { alert('SSL Hatasi: ' + (err.response?.data?.error || err.message)); }
  };
  const handlePhpChange = async (id, version) => {
    try { alert(`PHP surumu ${version} olarak degistiriliyor...`); await axios.post(`${API_BASE}/websites/${id}/php`, {version}); alert('PHP Surumu Guncellendi!'); fetchWebsites(); }
    catch (err) { alert('PHP Hatasi: ' + (err.response?.data?.error || err.message)); }
  };

  // DNS Functions
  const loadDnsRecords = async (domain) => {
      try {
          const { data } = await axios.get(`${API_BASE}/dns/${domain}`);
          setDnsRecords(data);
          setSelectedDnsDomain(domain);
      } catch (err) { alert('HATA: ' + (err.response?.data?.error || err.message)); }
  };
  const handleAddDnsRecord = async (e) => {
      e.preventDefault();
      try {
          await axios.post(`${API_BASE}/dns/${selectedDnsDomain}`, { name: newDnsName, type: newDnsType, value: newDnsValue, priority: newDnsPriority });
          setNewDnsName(''); setNewDnsValue(''); setNewDnsPriority('');
          loadDnsRecords(selectedDnsDomain);
      } catch (err) { alert('HATA: ' + (err.response?.data?.error || err.message)); }
  };
  const handleDeleteDnsRecord = async (id) => {
      if(!confirm('Bu DNS kaydını silmek istediğinize emin misiniz?')) return;
      try {
          await axios.delete(`${API_BASE}/dns/${selectedDnsDomain}/${id}`);
          loadDnsRecords(selectedDnsDomain);
      } catch (err) { alert('HATA: ' + (err.response?.data?.error || err.message)); }
  };

  // PHP INI Editor
  const handleLoadPhpIni = async (domain) => {
    if(!domain) { setPhpIniDomain(''); return; }
    try {
        const site = websites.find(w => w.domain === domain);
        if(!site) return;
        const { data } = await axios.get(`${API_BASE}/websites/${site.id}/php-ini`);
        setPhpIniSettings(data);
        setPhpIniDomain(domain);
    } catch (e) { alert('HATA: ' + (e.response?.data?.error || e.message)); }
  };

  const handleSavePhpIni = async (e) => {
    e.preventDefault();
    try {
        const site = websites.find(w => w.domain === phpIniDomain);
        await axios.post(`${API_BASE}/websites/${site.id}/php-ini`, phpIniSettings);
        alert('PHP INI Ayarları başarıyla güncellendi.');
    } catch (e) { alert('HATA: ' + (e.response?.data?.error || e.message)); }
  };

  // Cron Jobs
  const handleAddCron = async (e) => {
    e.preventDefault();
    try {
        await axios.post(`${API_BASE}/cron`, { domain: newCronDomain, minute: cronMin, hour: cronHour, day: cronDay, month: cronMonth, weekday: cronWeekday, command: cronCmd });
        setCronCmd('');
        fetchCrons();
    } catch (e) { alert('HATA: ' + (e.response?.data?.error || e.message)); }
  };

  const handleDeleteCron = async (id) => {
      if(!confirm('Zamanlanmış görevi silmek istediğinize emin misiniz?')) return;
      try {
          await axios.delete(`${API_BASE}/cron/${id}`);
          fetchCrons();
      } catch (e) { alert('HATA: ' + (e.response?.data?.error || e.message)); }
  };

  // Mail Accounts
  const handleAddMailAccount = async (e) => {
    e.preventDefault();
    if(!newMailDomain || !newMailUser || !newMailPass) return alert('Tüm alanlar zorunludur.');
    try {
        await axios.post(`${API_BASE}/mail`, { username: newMailUser, domain: newMailDomain, password: newMailPass, quota: newMailQuota });
        setNewMailUser(''); setNewMailPass('');
        fetchMailAccounts();
        alert('E-posta hesabı başarıyla oluşturuldu.');
    } catch (e) { alert('HATA: ' + (e.response?.data?.error || e.message)); }
  };

  const handleDeleteMailAccount = async (id) => {
      if(!confirm('Bu e-posta hesabını silmek istediğinize emin misiniz?')) return;
      try {
          await axios.delete(`${API_BASE}/mail/${id}`);
          fetchMailAccounts();
      } catch (e) { alert('HATA: ' + (e.response?.data?.error || e.message)); }
  };

  // Installer
  const handleInstallApp = async (appName) => {
    if(!installerDomain) return alert('Lütfen kurulum yapılacak domaini seçin.');
    if(!confirm(`${appName.toUpperCase()} uygulaması mevcut dosyalarınızı ezebilir. Onaylıyor musunuz?`)) return;
    
    setInstallerStatus(`${appName.toUpperCase()} indiriliyor ve kuruluyor...`);
    try {
        const { data } = await axios.post(`${API_BASE}/installer/${appName}`, { domain: installerDomain });
        setInstallerStatus('');
        alert(data.message);
    } catch (e) {
        setInstallerStatus('');
        alert('Kurulum Hatası: ' + (e.response?.data?.error || e.message));
    }
  };

  // Security
  const handleFirewallOp = async (op) => {
    try {
        await axios.post(`${API_BASE}/security/firewall`, { op, port: fwPort, protocol: fwProtocol, ruleNum: fwRuleNum });
        fetchSecurityData();
        setFwPort(''); setFwRuleNum('');
        if(op==='enable'||op==='disable') alert(`UFW ${op} başarılı.`);
    } catch (e) { alert('HATA: ' + (e.response?.data?.error || e.message)); }
  };

  const handleFail2BanOp = async (op) => {
    if(!f2bIp || !f2bJail) return alert('IP ve Jail girilmelidir.');
    try {
        await axios.post(`${API_BASE}/security/fail2ban`, { op, ip: f2bIp, jail: f2bJail });
        fetchSecurityData();
        setFwPort(''); setFwRuleNum('');
    } catch (e) { alert('HATA: ' + (e.response?.data?.error || e.message)); }
  };

  const handleAddDatabase = async (e) => {
    e.preventDefault();
    if (!newDbName || !newDbUser || !newDbPass) return alert('All fields required');
    try { await axios.post(`${API_BASE}/databases`, { dbName: newDbName, dbUser: newDbUser, dbPass: newDbPass }); setNewDbName(''); setNewDbUser(''); setNewDbPass(''); fetchDatabases(); } 
    catch (err) { alert('HATA: ' + (err.response?.data?.error || err.message)); }
  };
  const handleDeleteDatabase = async (id) => {
    try { await axios.delete(`${API_BASE}/databases/${id}`); fetchDatabases(); } 
    catch (err) { alert('HATA: ' + (err.response?.data?.error || err.message)); }
  };
  const handleAddFtpUser = async (e) => {
    e.preventDefault();
    if (!newFtpUser || !newFtpPass || !newFtpDomain) return alert('All fields required');
    try { await axios.post(`${API_BASE}/ftp`, { username: newFtpUser, password: newFtpPass, domain: newFtpDomain }); setNewFtpUser(''); setNewFtpPass(''); fetchFtpUsers(); } 
    catch (err) { alert('HATA: ' + (err.response?.data?.error || err.message)); }
  };
  const handleDeleteFtpUser = async (id) => {
    try { await axios.delete(`${API_BASE}/ftp/${id}`); fetchFtpUsers(); } 
    catch (err) { alert('HATA: ' + (err.response?.data?.error || err.message)); }
  };
  
  const handleAddUser = async (e) => {
    e.preventDefault();
    try { await axios.post(`${API_BASE}/users`, { username: newUser, password: newPass, role: newRole, package_id: selectedPackage }); setNewUser(''); setNewPass(''); fetchUsersList(); } 
    catch (err) { alert('HATA: ' + (err.response?.data?.error || err.message)); }
  };
  const handleDeleteUser = async (id) => {
    try { await axios.delete(`${API_BASE}/users/${id}`); fetchUsersList(); } 
    catch (err) { alert('HATA: ' + (err.response?.data?.error || err.message)); }
  };

  const handleAddPackage = async (e) => {
    e.preventDefault();
    try { await axios.post(`${API_BASE}/packages`, { name: newPkgName, max_websites: newPkgWebs, max_databases: newPkgDbs, max_ftp_users: newPkgFtps }); setNewPkgName(''); fetchPackagesList(); } 
    catch (err) { alert('HATA: ' + (err.response?.data?.error || err.message)); }
  };
  const handleDeletePackage = async (id) => {
    try { await axios.delete(`${API_BASE}/packages/${id}`); fetchPackagesList(); } 
    catch (err) { alert('HATA: ' + (err.response?.data?.error || err.message)); }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try { await axios.post(`${API_BASE}/settings`, serverSettings); alert('Settings Saved!'); } 
    catch (err) { alert('HATA: ' + (err.response?.data?.error || err.message)); }
  };

  const handleSystemUpdate = async () => {
    if(!confirm('Sunucuyu yayınlanan en güncel sürüme güncellemek ve yeniden başlatmak istediğinizden emin misiniz?')) return;
    try {
        alert('Güncelleme başlatıldı. Sistem arka planda derlenecek ve yaklaşık 20 saniye sonra yeniden başlayacaktır.');
        await axios.post(`${API_BASE}/system/update`);
        setTimeout(() => window.location.reload(), 20000);
    } catch(err) {
        alert('Güncelleme Hatası: ' + (err.response?.data?.error || err.message));
    }
  };

  // --- Render Login ---
  if (!token) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-900 bg-gradient-to-br from-slate-900 to-primary-950">
        <div className="glass-panel p-8 w-full max-w-sm flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary-500 to-primary-400 flex items-center justify-center text-white shadow-xl shadow-primary-500/30 mb-6">
            <Server className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">AppServer v6</h1>
          <p className="text-slate-400 text-sm mb-6 text-center">Ultimate Hosting Panel</p>
          
          <form className="w-full space-y-4" onSubmit={handleLogin}>
            {loginError && <div className="p-3 bg-red-500/20 border border-red-500/50 text-red-100 rounded-lg text-sm text-center">{loginError}</div>}
            <div>
              <input type="text" placeholder="Username" value={loginUser} onChange={(e)=>setLoginUser(e.target.value)} required 
                className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
            <div>
              <input type="password" placeholder="Password" value={loginPass} onChange={(e)=>setLoginPass(e.target.value)} required 
                className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
            <button type="submit" disabled={isLoggingIn} className="w-full btn-primary py-3 flex justify-center items-center gap-2">
              {isLoggingIn ? <Loader2 className=" animate-spin h-5 w-5" /> : 'Log In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- Render App ---
  const isAdmin = currentUser.role === 'admin';
  
  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: isAdmin ? 'WHM Dashboard' : 'cPanel Home' },
    { id: 'file-manager', icon: FolderSync, label: 'File Manager' },
    { id: 'websites', icon: Globe, label: 'Domains & DNS' },
    { id: 'databases', icon: Database, label: 'Databases' },
    { id: 'ftp', icon: FolderSync, label: 'FTP / Storage' },
    { id: 'mail', icon: Mail, label: 'Email Accounts' },
    { id: 'apps', icon: PackageSearch, label: '1-Click Apps' },
    { id: 'php-ini', icon: Sliders, label: 'Multi-PHP INI Editor' },
    { id: 'cron', icon: Clock, label: 'Cron Jobs' }
  ];
  if (isAdmin) navItems.push({ id: 'backups', icon: Archive, label: 'Backups (Global)' });
  if (isAdmin) navItems.push({ id: 'security', icon: ShieldCheck, label: 'Security Center' });
  if (isAdmin) navItems.push({ id: 'services', icon: ServerCog, label: 'Service & Log Manager' });
  if (isAdmin || currentUser.role === 'reseller') navItems.push({ id: 'users', icon: Users, label: 'Users & Sub-Accounts' });
  if (isAdmin) navItems.push({ id: 'packages', icon: Package, label: 'Hosting Packages' });
  if (isAdmin) navItems.push({ id: 'settings', icon: Settings, label: 'Server Settings' });

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-dark-900">
      {/* Sidebar */}
      <div className="w-64 glass-panel border-r border-slate-200 dark:border-white/10 flex flex-col z-10 transition-all duration-300">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-600 to-primary-400 flex items-center justify-center text-white shadow-lg shadow-primary-500/30">
            <Server className="h-6 w-6" />
          </div>
          <div>
            <span className="font-bold text-xl tracking-tight text-slate-800 dark:text-white block">AppServer</span>
            <span className={`text-xs font-semibold uppercase tracking-widest ${isAdmin ? 'text-primary-500' : 'text-emerald-500'}`}>
              {isAdmin ? 'WHM Admin (v6)' : 'cPanel User'}
            </span>
          </div>
        </div>
        
        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto mt-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                activeTab === item.id 
                  ? 'bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-400 font-medium' 
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200'
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 mt-auto">
          <div className="p-4 rounded-xl bg-slate-100 dark:bg-dark-800/80 mb-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex justify-center items-center text-slate-500 dark:text-slate-300 font-bold uppercase">{currentUser.username[0]}</div>
            <div className="overflow-hidden">
                <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{currentUser.username}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex justify-center items-center gap-2 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 py-2 rounded-lg transition-colors font-medium">
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-slate-50/50 dark:bg-dark-900/50 relative">
        <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-primary-100/40 to-transparent dark:from-primary-900/10 pointer-events-none"></div>
        <div className="p-8 max-w-6xl mx-auto relative z-10 animate-in fade-in duration-500">
          
          <header className="mb-8 flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-1 capitalize">{navItems.find(i => i.id === activeTab)?.label}</h1>
              <p className="text-slate-500 dark:text-slate-400">{isAdmin ? 'Global Server Management (WHM)' : 'Personal Web Hosting (cPanel)'}</p>
            </div>
          </header>

          {activeTab === 'dashboard' && isAdmin && (
            <div className="space-y-6 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-6 hover:shadow-xl transition-all duration-300 group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 rounded-xl group-hover:scale-110 transition-transform"><Cpu className="h-6 w-6" /></div>
                    <span className="text-xs font-semibold text-blue-500 bg-blue-50 dark:bg-blue-500/10 px-2 py-1 rounded-full">Live</span>
                  </div>
                  <div>
                    <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Server CPU Usage</h3>
                    <p className="text-3xl font-bold text-slate-800 dark:text-white flex items-end gap-2">
                      {systemInfo ? systemInfo.cpu : '--'} <span className="text-lg text-slate-400 mb-1">%</span>
                    </p>
                  </div>
                </div>

                <div className="glass-panel p-6 hover:shadow-xl transition-all duration-300 group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-primary-100 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400 rounded-xl group-hover:scale-110 transition-transform"><HardDrive className="h-6 w-6" /></div>
                  </div>
                  <div>
                    <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Server RAM Allocated</h3>
                    <p className="text-3xl font-bold text-slate-800 dark:text-white flex items-end gap-2">
                      {systemInfo ? systemInfo.memUsed : '--'} 
                      <span className="text-lg text-slate-400 mb-1">/ {systemInfo ? systemInfo.memTotal : '--'} GB</span>
                    </p>
                  </div>
                </div>
                
                <div className="glass-panel p-6 hover:shadow-xl transition-all duration-300 group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 rounded-xl group-hover:scale-110 transition-transform"><Globe className="h-6 w-6" /></div>
                  </div>
                  <div>
                    <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Hosted Domains (Total)</h3>
                    <p className="text-3xl font-bold text-slate-800 dark:text-white flex items-end gap-2">
                       {websites.length}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Update Panel */}
                 <div className="glass-panel p-6 hover:shadow-xl transition-all duration-300 group bg-gradient-to-br from-indigo-500/10 to-purple-500/5 dark:from-indigo-500/20 dark:to-purple-500/10 border-indigo-500/20">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/30 group-hover:scale-110 transition-transform"><CloudDownload className="h-6 w-6" /></div>
                      <span className="text-xs font-bold text-white bg-indigo-500 px-3 py-1 rounded-full animate-pulse shadow-md">v6.1 Yeni Sürüm 🎉</span>
                    </div>
                    <div>
                      <h3 className="text-slate-800 dark:text-slate-200 text-lg font-bold mb-1">Yeni Güncelleme Mevcut!</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">AppServer repo üzerinde yeni sürüm yayınlandı. Güncellemeyi web arayüzünden tek tıkla kurabilirsiniz.</p>
                      <button onClick={handleSystemUpdate} className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 focus:ring-2 focus:ring-indigo-500/50 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20 flex justify-center items-center gap-2">
                          <CloudDownload className="h-5 w-5" /> Şimdi Güncelle
                      </button>
                    </div>
                  </div>
              </div>
            </div>
          )}

          {activeTab === 'dashboard' && !isAdmin && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 animate-in slide-in-from-bottom-6">
              {[
                { icon: FolderSync, color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'File Manager', desc: 'Browse Files', tab: 'file-manager' },
                { icon: Globe, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Domains', desc: 'Add web sites', tab: 'websites' },
                { icon: Network, color: 'text-indigo-500', bg: 'bg-indigo-500/10', label: 'Zone Editor', desc: 'Manage DNS', tab: 'websites' },
                { icon: Database, color: 'text-orange-500', bg: 'bg-orange-500/10', label: 'Databases', desc: 'MySQL / MariaDB', tab: 'databases' },
                { icon: Code, color: 'text-violet-500', bg: 'bg-violet-500/10', label: 'Select PHP', desc: 'PHP-FPM Switcher', tab: 'websites' },
                { icon: ServerCog, color: 'text-fuchsia-500', bg: 'bg-fuchsia-500/10', label: 'phpMyAdmin', desc: 'SQL Access', tab: 'databases' },
                { icon: Archive, color: 'text-slate-500', bg: 'bg-slate-500/10', label: 'Backups', desc: 'tar.gz Restore', tab: 'websites' },
                { icon: ShieldCheck, color: 'text-green-500', bg: 'bg-green-500/10', label: 'SSL/TLS', desc: 'Let\'s Encrypt', tab: 'websites' },
              ].map((item, idx) => (
                <button key={idx} onClick={() => setActiveTab(item.tab)} className="glass-panel p-6 flex flex-col items-center justify-center text-center gap-4 hover:-translate-y-2 hover:shadow-xl hover:shadow-primary-500/20 transition-all duration-300">
                  <div className={`p-4 rounded-2xl ${item.bg} ${item.color}`}>
                    <item.icon className="h-10 w-10" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-white mb-1">{item.label}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {activeTab === 'file-manager' && (
             <div className="space-y-6">
                <div className="glass-panel p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <select 
                        value={fmWebsiteId} 
                        onChange={(e) => loadFileManager(e.target.value, 'public_html')} 
                        className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50 outline-none w-64">
                      <option value="">Select Domain Container...</option>
                      {websites.map(w => <option key={w.id} value={w.id}>{w.domain}</option>)}
                    </select>
                    {fmWebsiteId && (
                       <span className="text-slate-500 dark:text-slate-400 font-mono text-sm">Path: /{fmPath}</span>
                    )}
                  </div>
                  {fmWebsiteId && (
                     <form onSubmit={handleFmCreateFolder} className="flex gap-2">
                       <input type="text" value={fmNewFolder} onChange={(e) => setFmNewFolder(e.target.value)} placeholder="New Folder" className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg outline-none w-32" />
                       <button type="submit" className="btn-primary px-4"><Folder className="h-4 w-4 inline mr-1"/> Create</button>
                     </form>
                  )}
                </div>

                {fmWebsiteId && (
                   <div className="glass-panel overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50/50 dark:bg-dark-800/80 border-b border-white/10 text-slate-500 text-xs uppercase font-semibold">
                        <tr><th className="px-6 py-4">Name</th><th className="px-6 py-4">Size</th><th className="px-6 py-4">Last Modified</th><th className="px-6 py-4 text-right">Actions</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                        {fmItems.map(item => (
                           <tr key={item.name} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200 flex items-center gap-3">
                              {item.isDirectory ? <Folder className="text-blue-500 h-5 w-5" /> : <FileIcon className="text-slate-400 h-5 w-5" />}
                              {item.name}
                            </td>
                            <td className="px-6 py-4 text-slate-500">{item.isDirectory ? '-' : (item.size/1024).toFixed(2) + ' KB'}</td>
                            <td className="px-6 py-4 text-slate-500 text-sm">{new Date(item.mtime).toLocaleString()}</td>
                            <td className="px-6 py-4 text-right flex justify-end gap-2">
                              {item.isDirectory && <button onClick={() => loadFileManager(fmWebsiteId, fmPath + '/' + item.name)} className="text-primary-500 text-sm font-semibold hover:underline mr-4">Open</button>}
                              <button onClick={() => handleFmDelete(item.name)} className="text-slate-400 hover:text-red-500"><Trash2 className="h-5 w-5" /></button>
                            </td>
                           </tr>
                        ))}
                        {fmItems.length === 0 && <tr><td colSpan="4" className="text-center p-8 text-slate-500">Folder is empty</td></tr>}
                      </tbody>
                    </table>
                   </div>
                )}
             </div>
          )}

          {activeTab === 'websites' && (
            <div className="space-y-6 animate-in fade-in duration-500">
              
              {!selectedDnsDomain ? (
                <>
                  <div className="glass-panel p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-slate-800 dark:text-white">Deployed Domains & DNS</h2>
                      <p className="text-sm text-slate-500">Nginx Virtual Hosts and Bind9 Zones are created automatically.</p>
                    </div>
                    <form onSubmit={handleAddWebsite} className="flex gap-2 w-full md:w-auto">
                      <input type="text" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="example.com"
                        className="flex-1 md:w-64 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50 focus:ring-2 focus:ring-primary-500 outline-none" required />
                      <button type="submit" className="btn-primary flex items-center gap-2"><Plus className="h-4 w-4" /> Deploy TLD</button>
                    </form>
                  </div>

                  <div className="glass-panel overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50/50 dark:bg-dark-800/80 border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 uppercase text-xs font-semibold tracking-wider">
                        <tr>
                          <th className="px-6 py-4">Domain / Zone</th>
                          <th className="px-6 py-4">Web Server</th>
                          <th className="px-6 py-4">Engine / PHP</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                        {websites.map(site => (
                          <tr key={site.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-medium text-slate-800 dark:text-slate-200">{site.domain}</div>
                              <div className="text-xs text-slate-500 flex items-center gap-1 mt-1"><Network className="h-3 w-3" /> Auto DNS Hosted</div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-2.5 py-1 bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 rounded-full text-xs font-medium border border-green-200 dark:border-green-500/30">Nginx {site.status}</span>
                            </td>
                            <td className="px-6 py-4">
                              <select 
                                value={site.php_version || '8.1'} 
                                onChange={(e) => handlePhpChange(site.id, e.target.value)}
                                className="bg-transparent border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm text-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500">
                                <option value="7.4">PHP 7.4 (FPM)</option>
                                <option value="8.1">PHP 8.1 (FPM)</option>
                                <option value="8.2">PHP 8.2 (FPM)</option>
                              </select>
                            </td>
                            <td className="px-6 py-4 text-right flex justify-end gap-2">
                               <button onClick={() => loadDnsRecords(site.domain)} className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg flex items-center gap-1 text-sm font-semibold transition-colors" title="Manage DNS Zone"><Network className="h-4 w-4" /> DNS</button>
                               <button onClick={() => handleCreateBackup(site.id)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg flex items-center gap-1 text-sm" title="Backup Entire Site"><Archive className="h-4 w-4" /> Backup</button>
                              {site.has_ssl ? (
                                <span className="p-2 text-green-500 rounded-lg flex items-center gap-1 text-sm font-medium"><ShieldCheck className="h-4 w-4" /> SSL</span>
                              ) : (
                                <button onClick={() => handleInstallSSL(site.id)} className="p-2 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors flex items-center gap-1 text-sm"><ShieldCheck className="h-4 w-4" /> SSL</button>
                              )}
                              <button onClick={() => handleDeleteWebsite(site.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors title='Delete Domain and DNS'"><Trash2 className="h-5 w-5" /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="animate-in fade-in duration-300">
                  <div className="mb-4">
                    <button onClick={() => setSelectedDnsDomain(null)} className="text-sm font-medium text-slate-500 hover:text-primary-500 dark:text-slate-400">&larr; Back to Domains</button>
                  </div>
                  <div className="glass-panel p-6 flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><Network className="h-5 w-5" /> DNS Zone Editor: {selectedDnsDomain}</h2>
                      <p className="text-sm text-slate-500">Manage A, CNAME, TXT, MX records manually. SOA and default NS are handled automatically.</p>
                    </div>
                  </div>
                  
                  <div className="glass-panel p-6 mb-6">
                    <form onSubmit={handleAddDnsRecord} className="flex flex-wrap gap-4 items-end">
                      <div className="flex-1 min-w-[150px]">
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Name</label>
                        <input type="text" value={newDnsName} onChange={(e)=>setNewDnsName(e.target.value)} placeholder="e.g. sub or @ or _dmarc" required className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50 outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div className="w-32">
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Type</label>
                        <select value={newDnsType} onChange={(e)=>setNewDnsType(e.target.value)} className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50 outline-none focus:ring-2 focus:ring-primary-500">
                          <option value="A">A</option><option value="AAAA">AAAA</option><option value="CNAME">CNAME</option><option value="MX">MX</option><option value="TXT">TXT</option><option value="SRV">SRV</option>
                        </select>
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Record / Value</label>
                        <input type="text" value={newDnsValue} onChange={(e)=>setNewDnsValue(e.target.value)} placeholder="e.g. 192.168.1.1" required className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50 outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      {newDnsType === 'MX' && (
                        <div className="w-24">
                          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Priority</label>
                          <input type="number" value={newDnsPriority} onChange={(e)=>setNewDnsPriority(e.target.value)} placeholder="10" required className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50 outline-none focus:ring-2 focus:ring-primary-500" />
                        </div>
                      )}
                      <button type="submit" className="btn-primary py-2 px-6 flex items-center gap-2"><Plus className="h-4 w-4" /> Add Record</button>
                    </form>
                  </div>
                  
                  <div className="glass-panel overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50/50 dark:bg-dark-800/80 border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 uppercase text-xs font-semibold tracking-wider">
                        <tr><th className="px-6 py-4">Name</th><th className="px-6 py-4">Type</th><th className="px-6 py-4">Value</th><th className="px-6 py-4">Priority</th><th className="px-6 py-4 text-right">Delete</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                        {dnsRecords.map(rec => (
                           <tr key={rec.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                             <td className="px-6 py-4 font-mono font-bold text-slate-800 dark:text-slate-200">{rec.name}</td>
                             <td className="px-6 py-4"><span className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-xs font-bold">{rec.type}</span></td>
                             <td className="px-6 py-4 font-mono text-slate-600 dark:text-slate-300">{rec.value}</td>
                             <td className="px-6 py-4 text-slate-500">{rec.priority || '-'}</td>
                             <td className="px-6 py-4 text-right">
                               <button onClick={() => handleDeleteDnsRecord(rec.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"><Trash2 className="h-5 w-5" /></button>
                             </td>
                           </tr>
                        ))}
                        {dnsRecords.length === 0 && <tr><td colSpan="5" className="px-6 py-12 text-center text-slate-500">No custom DNS records added yet.</td></tr>}
                      </tbody>
                    </table>
                  </div>

                </div>
              )}

            </div>
          )}

          {activeTab === 'databases' && (
            <div className="space-y-6 animate-in fade-in duration-500">
               <div className="glass-panel p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                  <form onSubmit={handleAddDatabase} className="flex gap-2 w-full flex-wrap md:flex-nowrap">
                    <input type="text" value={newDbName} onChange={(e) => setNewDbName(e.target.value)} placeholder="DB Name" className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50 focus:ring-2 focus:ring-primary-500 outline-none w-full md:w-auto" />
                    <input type="text" value={newDbUser} onChange={(e) => setNewDbUser(e.target.value)} placeholder="DB User" className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50 focus:ring-2 focus:ring-primary-500 outline-none w-full md:w-auto" />
                    <input type="password" value={newDbPass} onChange={(e) => setNewDbPass(e.target.value)} placeholder="Password" className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50 focus:ring-2 focus:ring-primary-500 outline-none w-full md:w-auto" />
                    <button type="submit" className="btn-primary flex items-center gap-2 px-6"><Plus className="h-4 w-4" /> Create DB</button>
                  </form>
               </div>
               <div className="glass-panel overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 dark:bg-dark-800/80 border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 uppercase text-xs font-semibold tracking-wider">
                    <tr><th className="px-6 py-4">Database Name</th><th className="px-6 py-4">Linked Website (For PMA)</th><th className="px-6 py-4">Created Date</th><th className="px-6 py-4 text-right">Actions</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                    {databases.map(db => (
                      <tr key={db.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200 flex items-center gap-3"><Database className="h-5 w-5 text-slate-400" />{db.db_name}</td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                            {websites.length > 0 ? (
                                <button onClick={() => handleInstallPma(websites[0].id)} className="text-primary-500 text-sm font-semibold flex items-center gap-1 hover:underline"><ServerCog className="h-4 w-4" /> Go to phpMyAdmin</button>
                            ) : '-'}
                        </td>
                        <td className="px-6 py-4 text-slate-500 text-sm">{new Date(db.created_at).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-right">
                           <button onClick={() => handleDeleteDatabase(db.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="h-5 w-5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {activeTab === 'backups' && (
             <div className="space-y-6">
                <div className="glass-panel p-6">
                  <h2 className="text-xl font-bold dark:text-white mb-2">Global Backup Repository</h2>
                  <p className="text-sm text-slate-500 mb-6">Listed below are all tar.gz archives created by users through the cPanel dashboard.</p>
                  
                  <table className="w-full text-left">
                     <thead className="bg-slate-50/50 dark:bg-dark-800/80 border-b border-white/10 text-slate-500 text-xs uppercase font-semibold">
                       <tr><th className="py-4 px-6">Archive Name</th><th className="py-4 px-6">Size</th><th className="py-4 px-6">Generated ON</th><th className="py-4 px-6 text-right">Actions</th></tr>
                     </thead>
                     <tbody className="divide-y divide-white/5">
                       {backupsList.map(b => (
                          <tr key={b.filename} className="hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4 font-mono text-emerald-500 font-semibold">{b.filename}</td>
                            <td className="px-6 py-4 text-slate-400">{(b.size / 1024 / 1024).toFixed(2)} MB</td>
                            <td className="px-6 py-4 text-slate-400">{new Date(b.created_at).toLocaleString()}</td>
                            <td className="px-6 py-4 text-right flex justify-end gap-2">
                               <button onClick={() => handleRestoreBackup(b.filename)} className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg flex items-center gap-1 text-sm font-semibold transition-colors"><FolderSync className="h-4 w-4" /> Restore</button>
                               <button onClick={() => handleDeleteBackup(b.filename)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="h-5 w-5" /></button>
                            </td>
                          </tr>
                       ))}
                     </tbody>
                  </table>
                </div>
             </div>
          )}

          {activeTab === 'ftp' && (
            <div className="space-y-6">
              <div className="glass-panel p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <form onSubmit={handleAddFtpUser} className="flex gap-2 w-full flex-wrap md:flex-nowrap">
                  <input type="text" value={newFtpUser} onChange={(e) => setNewFtpUser(e.target.value)} placeholder="Username" className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50 focus:ring-2 focus:ring-primary-500 outline-none w-full" />
                  <input type="password" value={newFtpPass} onChange={(e) => setNewFtpPass(e.target.value)} placeholder="Password" className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50 focus:ring-2 focus:ring-primary-500 outline-none w-full" />
                  <select value={newFtpDomain} onChange={(e) => setNewFtpDomain(e.target.value)} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50 focus:ring-2 focus:ring-primary-500 outline-none w-full">
                    <option value="">Link to Document Root</option>
                    {websites.map(w => <option key={w.id} value={w.domain}>{w.domain}</option>)}
                  </select>
                  <button type="submit" className="btn-primary flex items-center gap-2"><Plus className="h-4 w-4" /> Add FTP</button>
                </form>
              </div>
              <div className="glass-panel overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 dark:bg-dark-800/80 border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 uppercase text-xs font-semibold tracking-wider">
                    <tr><th className="px-6 py-4">FTP Username</th><th className="px-6 py-4">Restricted To Directory</th><th className="px-6 py-4">Created Date</th><th className="px-6 py-4 text-right">Actions</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                    {ftpUsers.map(user => (
                      <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200 flex items-center gap-3"><FolderSync className="h-5 w-5 text-slate-400" />{user.username}</td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">/var/www/{user.domain}</td>
                        <td className="px-6 py-4 text-slate-500 text-sm">{new Date(user.created_at).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => handleDeleteFtpUser(user.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="h-5 w-5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'php-ini' && (
            <div className="space-y-6 animate-in fade-in duration-500">
               <div className="glass-panel p-6">
                 <h2 className="text-xl font-bold dark:text-white mb-2 flex items-center gap-2"><Sliders className="h-5 w-5"/> Multi-PHP INI Editor</h2>
                 <p className="text-sm text-slate-500 mb-6">Manage PHP limits on a per-domain basis using .user.ini overrides.</p>
                 <div className="flex gap-4 mb-6">
                    <select value={phpIniDomain} onChange={(e) => handleLoadPhpIni(e.target.value)} className="w-full md:w-1/2 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50">
                        <option value="">Select Domain...</option>
                        {websites.map(w => <option key={w.id} value={w.domain}>{w.domain}</option>)}
                    </select>
                 </div>
                 {phpIniDomain && (
                    <form onSubmit={handleSavePhpIni} className="space-y-4 max-w-lg">
                       <div>
                         <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">Memory Limit</label>
                         <input type="text" value={phpIniSettings.memory_limit} onChange={(e)=>setPhpIniSettings({...phpIniSettings, memory_limit: e.target.value})} className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50" />
                       </div>
                       <div>
                         <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">Upload Max Filesize</label>
                         <input type="text" value={phpIniSettings.upload_max_filesize} onChange={(e)=>setPhpIniSettings({...phpIniSettings, upload_max_filesize: e.target.value})} className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50" />
                       </div>
                       <div>
                         <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">Post Max Size</label>
                         <input type="text" value={phpIniSettings.post_max_size} onChange={(e)=>setPhpIniSettings({...phpIniSettings, post_max_size: e.target.value})} className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50" />
                       </div>
                       <div>
                         <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">Max Execution Time (seconds)</label>
                         <input type="text" value={phpIniSettings.max_execution_time} onChange={(e)=>setPhpIniSettings({...phpIniSettings, max_execution_time: e.target.value})} className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50" />
                       </div>
                       <button type="submit" className="btn-primary w-full shadow-lg shadow-primary-500/30">Save Application Limits</button>
                    </form>
                 )}
               </div>
            </div>
          )}

          {activeTab === 'cron' && (
             <div className="space-y-6 animate-in fade-in duration-500">
                <div className="glass-panel p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                   <div>
                     <h2 className="text-xl font-bold dark:text-white flex items-center gap-2"><Clock className="h-5 w-5"/> Cron Jobs</h2>
                     <p className="text-sm text-slate-500">Automate commands or scripts on your site. Format: Min Hour Day Month Weekday</p>
                   </div>
                </div>
                <div className="glass-panel p-6 mb-6">
                   <form onSubmit={handleAddCron} className="flex flex-wrap gap-2 items-end">
                      <select value={newCronDomain} onChange={(e) => setNewCronDomain(e.target.value)} className="px-4 py-2 w-full md:w-auto border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50" required>
                          <option value="">Document Root Domain</option>
                          {websites.map(w => <option key={w.id} value={w.domain}>{w.domain}</option>)}
                      </select>
                      <input type="text" value={cronMin} onChange={(e)=>setCronMin(e.target.value)} title="Minute" className="w-16 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50" required />
                      <input type="text" value={cronHour} onChange={(e)=>setCronHour(e.target.value)} title="Hour" className="w-16 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50" required />
                      <input type="text" value={cronDay} onChange={(e)=>setCronDay(e.target.value)} title="Day of Month" className="w-16 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50" required />
                      <input type="text" value={cronMonth} onChange={(e)=>setCronMonth(e.target.value)} title="Month" className="w-16 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50" required />
                      <input type="text" value={cronWeekday} onChange={(e)=>setCronWeekday(e.target.value)} title="Day of Week" className="w-16 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50" required />
                      
                      <input type="text" value={cronCmd} onChange={(e)=>setCronCmd(e.target.value)} placeholder="Command (e.g. /usr/bin/php /var/www/domain/script.php)" className="flex-1 min-w-[300px] px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50" required />
                      <button type="submit" className="btn-primary flex items-center gap-2 px-6"><Plus className="h-4 w-4" /> Add Cron</button>
                   </form>
                </div>
                <div className="glass-panel overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/50 dark:bg-dark-800/80 border-b border-white/10 text-slate-500 text-xs uppercase font-semibold">
                      <tr><th className="px-6 py-4">Domain</th><th className="px-6 py-4">M H D M W</th><th className="px-6 py-4">Command</th><th className="px-6 py-4 text-right">Delete</th></tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {cronsList.map(c => (
                         <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                           <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{c.domain}</td>
                           <td className="px-6 py-4 font-mono text-primary-500 font-bold tracking-widest">{c.minute} {c.hour} {c.day} {c.month} {c.weekday}</td>
                           <td className="px-6 py-4 font-mono text-sm text-slate-600 dark:text-slate-400 max-w-md truncate" title={c.command}>{c.command}</td>
                           <td className="px-6 py-4 text-right flex justify-end">
                             <button onClick={() => handleDeleteCron(c.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg"><Trash2 className="h-5 w-5" /></button>
                           </td>
                         </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
             </div>
          )}

          {activeTab === 'mail' && (
             <div className="space-y-6 animate-in fade-in duration-500">
                <div className="glass-panel p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                   <div>
                     <h2 className="text-xl font-bold dark:text-white flex items-center gap-2"><Mail className="h-5 w-5"/> Email Accounts</h2>
                     <p className="text-sm text-slate-500">Create domain-based e-mail accounts. Backend configures Postfix virtual mailboxes automatically.</p>
                   </div>
                   <form onSubmit={handleAddMailAccount} className="flex gap-2 w-full md:w-auto mt-4 md:mt-0 items-center bg-white/5 dark:bg-black/20 p-2 rounded-xl">
                      <input type="text" value={newMailUser} onChange={(e) => setNewMailUser(e.target.value)} placeholder="name" required className="w-24 md:w-32 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50" />
                      <span className="text-slate-500 font-bold">@</span>
                      <select value={newMailDomain} onChange={(e) => setNewMailDomain(e.target.value)} required className="w-32 md:w-40 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50">
                          <option value="">Domain</option>
                          {websites.map(w => <option key={w.id} value={w.domain}>{w.domain}</option>)}
                      </select>
                      <input type="password" value={newMailPass} onChange={(e) => setNewMailPass(e.target.value)} placeholder="Password" required className="w-32 md:w-40 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50" />
                      <button type="submit" className="btn-primary flex items-center gap-2"><Plus className="h-4 w-4" /> Create</button>
                   </form>
                </div>
                <div className="glass-panel overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/50 dark:bg-dark-800/80 border-b border-white/10 text-slate-500 text-xs uppercase font-semibold">
                      <tr><th className="px-6 py-4">E-Mail Address</th><th className="px-6 py-4">Domain</th><th className="px-6 py-4">Quota</th><th className="px-6 py-4 text-right">Delete</th></tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {mailAccounts.map(m => (
                         <tr key={m.id} className="hover:bg-white/5 transition-colors">
                           <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><Mail className="h-4 w-4 text-slate-400" />{m.username}</td>
                           <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{m.domain}</td>
                           <td className="px-6 py-4 text-slate-500">{m.quota}</td>
                           <td className="px-6 py-4 text-right flex justify-end">
                             <a href={`http://${m.domain}/webmail`} target="_blank" rel="noreferrer" className="p-2 text-indigo-500 hover:bg-indigo-500/10 rounded-lg flex items-center gap-1 text-sm mr-2 font-semibold">Webmail &rarr;</a>
                             <button onClick={() => handleDeleteMailAccount(m.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg"><Trash2 className="h-5 w-5" /></button>
                           </td>
                         </tr>
                      ))}
                      {mailAccounts.length === 0 && <tr><td colSpan="4" className="px-6 py-12 text-center text-slate-500">No email accounts found.</td></tr>}
                    </tbody>
                  </table>
                </div>
             </div>
          )}

          {activeTab === 'apps' && (
             <div className="space-y-6 animate-in fade-in duration-500">
                <div className="glass-panel p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                   <div>
                     <h2 className="text-xl font-bold dark:text-white flex items-center gap-2"><PackageSearch className="h-5 w-5"/> 1-Click App Installer</h2>
                     <p className="text-sm text-slate-500">Softaculous style auto-deployment for your domains.</p>
                   </div>
                   <select value={installerDomain} onChange={(e) => setInstallerDomain(e.target.value)} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50 w-full md:w-auto">
                      <option value="">Select Installation Domain...</option>
                      {websites.map(w => <option key={w.id} value={w.domain}>{w.domain}</option>)}
                   </select>
                </div>
                
                {installerStatus && (
                  <div className="p-4 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800 flex items-center gap-3">
                     <Loader2 className="h-5 w-5 animate-spin" />
                     {installerStatus}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {/* WordPress Card */}
                   <div className="glass-panel p-6 flex flex-col justify-between hover:border-primary-500/50 transition-colors group">
                      <div>
                        <div className="flex justify-between items-start mb-4">
                           <div className="h-12 w-12 rounded-xl bg-[#21759b]/10 text-[#21759b] flex items-center justify-center text-3xl font-bold font-serif">W</div>
                           <span className="px-2 py-1 bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 text-xs font-bold rounded">Active</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">WordPress</h3>
                        <p className="text-sm text-slate-500 mb-6">Create beautiful websites, blogs, or apps using the world's most popular open-source CMS. The installer will extract the latest build directly to your public_html.</p>
                      </div>
                      <button onClick={()=>handleInstallApp('wordpress')} disabled={!installerDomain || !!installerStatus} className="btn-primary w-full shadow-lg h-10">
                         Install Now
                      </button>
                   </div>
                   
                   {/* Laravel Card */}
                   <div className="glass-panel p-6 flex flex-col justify-between hover:border-red-500/50 transition-colors group">
                      <div>
                        <div className="flex justify-between items-start mb-4">
                           <div className="h-12 w-12 rounded-xl bg-[#ff2d20]/10 text-[#ff2d20] flex items-center justify-center text-xl font-bold font-mono">L.</div>
                           <span className="px-2 py-1 bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 text-xs font-bold rounded">Active</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Laravel Framework</h3>
                        <p className="text-sm text-slate-500 mb-6">The elegant PHP web framework. The installer will run 'composer create-project', generate the app key, and configure your Nginx vhost to point to the /public directory.</p>
                      </div>
                      <button onClick={()=>handleInstallApp('laravel')} disabled={!installerDomain || !!installerStatus} className="w-full bg-slate-900 hover:bg-black text-white px-4 py-2 rounded-lg font-medium shadow dark:shadow-[0_0_15px_rgba(255,45,32,0.3)] transition-all flex items-center justify-center gap-2 h-10 disabled:opacity-50">
                         Install Laravel
                      </button>
                   </div>

                   {/* SitePad Card */}
                   <div className="glass-panel p-6 flex flex-col justify-between hover:border-blue-500/50 transition-colors group">
                      <div>
                        <div className="flex justify-between items-start mb-4">
                           <div className="h-12 w-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center text-xl font-bold font-sans">SP</div>
                           <span className="px-2 py-1 bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 text-xs font-bold rounded">Active</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">SitePad Website Builder</h3>
                        <p className="text-sm text-slate-500 mb-6">Sürükle bırak ile kolayca 1000'den fazla temayı kullanarak sitenizi oluşturun. Kod bilmeden tasarımlarınızı anında yayınlayın.</p>
                      </div>
                      <button onClick={()=>handleInstallApp('sitepad')} disabled={!installerDomain || !!installerStatus} className="w-full bg-blue-500 hover:bg-blue-600 focus:ring-2 focus:ring-blue-500/50 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20 flex justify-center items-center gap-2 h-10 disabled:opacity-50">
                         Install SitePad
                      </button>
                   </div>
                </div>
             </div>
          )}

          {activeTab === 'users' && (isAdmin || currentUser.role === 'reseller') && (
            <div className="space-y-6">
              <div className="glass-panel p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <form onSubmit={handleAddUser} className="flex gap-2 w-full flex-wrap md:flex-nowrap">
                  <input type="text" value={newUser} onChange={(e) => setNewUser(e.target.value)} placeholder="Username" className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50 focus:ring-2 focus:ring-primary-500 outline-none w-full md:w-auto" required />
                  <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Password" className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50 focus:ring-2 focus:ring-primary-500 outline-none w-full md:w-auto" required />
                  
                  <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50 focus:ring-2 focus:ring-primary-500 outline-none">
                    <option value="user">User</option>
                    {isAdmin && <option value="reseller">Reseller</option>}
                  </select>

                  <select value={selectedPackage} onChange={(e) => setSelectedPackage(e.target.value)} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50 focus:ring-2 focus:ring-primary-500 outline-none">
                    <option value="">No Package</option>
                    {packagesList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>

                  <button type="submit" className="btn-primary flex items-center gap-2 px-6"><Plus className="h-4 w-4" /> Create User</button>
                </form>
              </div>
              <div className="glass-panel overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 dark:bg-dark-800/80 border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 uppercase text-xs font-semibold tracking-wider">
                    <tr><th className="px-6 py-4">Username</th><th className="px-6 py-4">Role</th><th className="px-6 py-4">Package</th><th className="px-6 py-4 text-right">Actions</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                    {usersList.map(user => (
                      <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{user.username} {user.id === currentUser.id && "(You)"}</td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300 uppercase text-xs font-bold">{user.role}</td>
                        <td className="px-6 py-4 text-slate-500 text-sm">{packagesList.find(p => p.id === user.package_id)?.name || 'None'}</td>
                        <td className="px-6 py-4 text-right">
                          {user.id !== currentUser.id && (
                            <button onClick={() => handleDeleteUser(user.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="h-5 w-5" /></button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'security' && isAdmin && (
            <div className="space-y-6 animate-in fade-in duration-500">
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 leading-relaxed">
                  {/* UFW Firewall */}
                  <div className="glass-panel p-6 flex flex-col h-full">
                     <h2 className="text-xl font-bold dark:text-white mb-2 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-green-500"/> AppServer Firewall (UFW)</h2>
                     <p className="text-sm text-slate-500 mb-4">Manage TCP/UDP ports and block IP ranges via Linux Uncomplicated Firewall.</p>
                     
                     <div className="bg-black/80 rounded-lg p-4 font-mono text-sm text-green-400 mb-6 overflow-x-auto whitespace-pre h-64 shadow-inner">
                        {firewallStatus || "Status: Loading..."}
                     </div>
                     
                     <div className="flex gap-2 mb-4">
                        <button onClick={()=>handleFirewallOp('enable')} className="flex-1 bg-green-500/20 text-green-600 dark:text-green-400 px-4 py-2 font-bold rounded-lg hover:bg-green-500/30">Enable UFW</button>
                        <button onClick={()=>handleFirewallOp('disable')} className="flex-1 bg-red-500/20 text-red-600 dark:text-red-400 px-4 py-2 font-bold rounded-lg hover:bg-red-500/30">Disable UFW</button>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <input type="text" placeholder="Port (e.g. 22)" value={fwPort} onChange={e=>setFwPort(e.target.value)} className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50" />
                           <select value={fwProtocol} onChange={e=>setFwProtocol(e.target.value)} className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50">
                              <option value="tcp">TCP</option><option value="udp">UDP</option>
                           </select>
                           <button onClick={()=>handleFirewallOp('add')} className="btn-primary w-full shadow-lg shadow-primary-500/30 text-sm py-2">Open Port</button>
                        </div>
                        <div className="space-y-2">
                           <input type="number" placeholder="Rule # to Delete" value={fwRuleNum} onChange={e=>setFwRuleNum(e.target.value)} className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50" />
                           <button onClick={()=>handleFirewallOp('delete')} className="w-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white px-4 py-2 font-semibold rounded-lg hover:bg-red-500 hover:text-white transition text-sm">Delete Rule</button>
                        </div>
                     </div>
                  </div>

                  {/* Fail2Ban */}
                  <div className="glass-panel p-6 flex flex-col h-full">
                     <h2 className="text-xl font-bold dark:text-white mb-2 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-red-500"/> Intrusion Prevention (Fail2Ban)</h2>
                     <p className="text-sm text-slate-500 mb-4">Automatically protect SSH, FTP, and Web layers from brute-force botnets.</p>
                     
                     <div className="bg-[#1e1e1e] rounded-lg p-4 font-mono text-sm text-slate-300 mb-6 overflow-x-auto whitespace-pre h-64 shadow-inner">
                        <span className="text-primary-400 font-bold block mb-2"># Global Status #</span>
                        {fail2banStatus.status || "Status: Loading..."}
                        <span className="text-primary-400 font-bold block mb-2 mt-4"># SSHD Jail Status #</span>
                        {fail2banStatus.sshd || "Jail Status: Loading..."}
                     </div>
                     
                     <div className="mt-auto space-y-4">
                        <div className="flex gap-2 items-center text-sm font-semibold text-slate-600 dark:text-slate-300">
                           <span>Target IP:</span>
                           <input type="text" placeholder="123.45.67.89" value={f2bIp} onChange={e=>setF2bIp(e.target.value)} className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50" />
                           <span>Jail:</span>
                           <input type="text" value={f2bJail} onChange={e=>setF2bJail(e.target.value)} className="w-24 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50" />
                        </div>
                        <div className="flex gap-2">
                           <button onClick={()=>handleFail2BanOp('unban')} className="flex-1 btn-primary shadow-lg shadow-primary-500/30">Unban IP</button>
                           <button onClick={()=>handleFail2BanOp('ban')} className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2 font-bold rounded-lg shadow-lg shadow-red-500/30">Force Ban IP</button>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'packages' && isAdmin && (
            <div className="space-y-6">
              <div className="glass-panel p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <form onSubmit={handleAddPackage} className="flex gap-2 w-full flex-wrap md:flex-nowrap">
                  <input type="text" value={newPkgName} onChange={(e) => setNewPkgName(e.target.value)} placeholder="Package Name" className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg outline-none" required />
                  <input type="number" min="1" value={newPkgWebs} onChange={(e) => setNewPkgWebs(e.target.value)} placeholder="Max Websites" className="w-24 px-4 py-2 border border-slate-300 rounded-lg" title="Max Websites" required />
                  <input type="number" min="1" value={newPkgDbs} onChange={(e) => setNewPkgDbs(e.target.value)} placeholder="Max DBs" className="w-24 px-4 py-2 border border-slate-300 rounded-lg" title="Max DBs" required />
                  <input type="number" min="1" value={newPkgFtps} onChange={(e) => setNewPkgFtps(e.target.value)} placeholder="Max FTPs" className="w-24 px-4 py-2 border border-slate-300 rounded-lg" title="Max FTPs" required />
                  <button type="submit" className="btn-primary flex items-center gap-2"><Plus className="h-4 w-4" /> Add Pkg</button>
                </form>
              </div>
              <div className="glass-panel overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 text-slate-500 uppercase text-xs font-semibold">
                    <tr><th className="px-6 py-4">Package</th><th className="px-6 py-4">Limits (Web / DB / FTP)</th><th className="px-6 py-4 text-right">Actions</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {packagesList.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 font-medium text-slate-800"><Package className="inline h-4 w-4 mr-2" />{p.name}</td>
                        <td className="px-6 py-4 text-slate-600">{p.max_websites} / {p.max_databases} / {p.max_ftp_users}</td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => handleDeletePackage(p.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-lg"><Trash2 className="h-5 w-5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'settings' && isAdmin && (
            <div className="space-y-6 animate-in fade-in duration-500">
               <div className="glass-panel p-6">
                 <h2 className="text-xl font-bold dark:text-white mb-2">Global Server Settings</h2>
                 <p className="text-sm text-slate-500 mb-6">Manage default Name Servers and Server IP address here.</p>
                 <form onSubmit={handleSaveSettings} className="space-y-4 max-w-lg">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Default NS1</label>
                      <input type="text" value={serverSettings.ns1 || ''} onChange={(e) => setServerSettings({...serverSettings, ns1: e.target.value})} className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50 outline-none" placeholder="ns1.yourdomain.com" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Default NS2</label>
                      <input type="text" value={serverSettings.ns2 || ''} onChange={(e) => setServerSettings({...serverSettings, ns2: e.target.value})} className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50 outline-none" placeholder="ns2.yourdomain.com" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Server IP Address</label>
                      <input type="text" value={serverSettings.server_ip || ''} onChange={(e) => setServerSettings({...serverSettings, server_ip: e.target.value})} className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50 outline-none" placeholder="127.0.0.1" required />
                    </div>
                    <button type="submit" className="btn-primary flex items-center gap-2 mt-4 px-6"><Settings className="h-4 w-4" /> Save Settings</button>
                 </form>
               </div>
            </div>
          )}

          {activeTab === 'services' && isAdmin && (
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="glass-panel p-6">
                    <h2 className="text-xl font-bold dark:text-white mb-4">System Service Management</h2>
                    <div className="overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50 dark:bg-dark-800/80 border-b border-white/10 text-slate-500 text-xs uppercase font-semibold">
                            <tr><th className="py-4 px-6">Service Name (ID)</th><th className="py-4 px-6">Status</th><th className="py-4 px-6 text-right">Actions</th></tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {serverServices.map(s => (
                                    <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{s.name} <span className="text-xs text-slate-500 font-normal ml-2">({s.id})</span></td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${s.status === 'active' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30' : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30'}`}>
                                                {s.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                                            <button onClick={() => controlService(s.id, 'start')} className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg text-sm font-semibold transition-colors">Start</button>
                                            <button onClick={() => controlService(s.id, 'restart')} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg text-sm font-semibold transition-colors">Restart</button>
                                            <button onClick={() => controlService(s.id, 'stop')} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg text-sm font-semibold transition-colors">Stop</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="glass-panel p-6">
                    <h2 className="text-xl font-bold flex items-center gap-2 dark:text-white mb-4"><Code className="h-5 w-5 text-slate-400" /> Live Log Viewer</h2>
                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                        <select value={logPath} onChange={(e) => setLogPath(e.target.value)} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50 focus:ring-2 focus:ring-primary-500 text-sm text-slate-800 dark:text-slate-200 outline-none w-full md:w-96">
                            <option value="/var/log/nginx/error.log">Web Server Error Log (Nginx)</option>
                            <option value="/var/log/nginx/access.log">Web Server Access Log</option>
                            <option value="/var/log/syslog">General System Log (syslog)</option>
                            <option value="/var/log/mysql/error.log">MySQL / MariaDB Error Log</option>
                            <option value="/var/log/auth.log">Authentication Log (SSH/FTP)</option>
                        </select>
                        <button onClick={fetchLogs} className="btn-primary px-6 py-2 text-sm flex items-center justify-center gap-2 shadow-lg w-full md:w-auto"><FolderSync className="h-4 w-4" /> Load Last 100 Lines</button>
                    </div>
                    <div className="bg-slate-900 text-emerald-400 p-4 rounded-xl font-mono text-xs overflow-auto h-96 border border-slate-800 shadow-inner whitespace-pre select-text">
                        {logData || 'Lütfen "Load Last 100 Lines" butonuna basarak log kayıtlarını getirin...'}
                    </div>
                </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default App;
