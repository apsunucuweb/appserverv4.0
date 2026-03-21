import { useState, useEffect } from 'react';
import axios from 'axios';
import { LayoutDashboard, Globe, Database, Settings, Server, Cpu, HardDrive, Plus, Trash2, ShieldCheck, FolderSync, Users, Package, LogOut, Loader2 } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [currentUser, setCurrentUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [systemInfo, setSystemInfo] = useState(null);

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
  
  // Users & Packages
  const [usersList, setUsersList] = useState([]);
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [selectedPackage, setSelectedPackage] = useState('');

  const [packagesList, setPackagesList] = useState([]);
  const [newPkgName, setNewPkgName] = useState('');
  const [newPkgWebs, setNewPkgWebs] = useState(1);
  const [newPkgDbs, setNewPkgDbs] = useState(1);
  const [newPkgFtps, setNewPkgFtps] = useState(1);

  // Setup Axios globally
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
    fetchSystemInfo();
    fetchWebsites();
    fetchDatabases();
    fetchFtpUsers();
    if (currentUser?.role === 'admin' || currentUser?.role === 'reseller') {
      fetchUsersList();
      fetchPackagesList();
    }
  };

  const fetchSystemInfo = async () => { try { const { data } = await axios.get(`${API_BASE}/system`); setSystemInfo(data); } catch (e) { } };
  const fetchWebsites = async () => { try { const { data } = await axios.get(`${API_BASE}/websites`); setWebsites(data); } catch (e) { } };
  const fetchDatabases = async () => { try { const { data } = await axios.get(`${API_BASE}/databases`); setDatabases(data); } catch (e) { } };
  const fetchFtpUsers = async () => { try { const { data } = await axios.get(`${API_BASE}/ftp`); setFtpUsers(data); } catch (e) { } };
  
  const fetchUsersList = async () => { try { const { data } = await axios.get(`${API_BASE}/users`); setUsersList(data); } catch (e) { } };
  const fetchPackagesList = async () => { try { const { data } = await axios.get(`${API_BASE}/packages`); setPackagesList(data); } catch (e) { } };

  // --- Handlers ---
  const handleAddWebsite = async (e) => {
    e.preventDefault();
    if (!newDomain) return;
    try { await axios.post(`${API_BASE}/websites`, { domain: newDomain }); setNewDomain(''); fetchWebsites(); } 
    catch (err) { alert('Failed to add website'); }
  };
  const handleDeleteWebsite = async (id) => {
    try { await axios.delete(`${API_BASE}/websites/${id}`); fetchWebsites(); } 
    catch (err) { alert('Failed to delete website'); }
  };
  const handleInstallSSL = async (id) => {
    try { alert('SSL Installation started...'); await axios.post(`${API_BASE}/websites/${id}/ssl`); alert('SSL Installed!'); fetchWebsites(); } 
    catch (err) { alert('Failed to install SSL.'); }
  };
  const handleAddDatabase = async (e) => {
    e.preventDefault();
    if (!newDbName || !newDbUser || !newDbPass) return alert('All fields required');
    try { await axios.post(`${API_BASE}/databases`, { dbName: newDbName, dbUser: newDbUser, dbPass: newDbPass }); setNewDbName(''); setNewDbUser(''); setNewDbPass(''); fetchDatabases(); } 
    catch (err) { alert('Failed to build database'); }
  };
  const handleDeleteDatabase = async (id) => {
    try { await axios.delete(`${API_BASE}/databases/${id}`); fetchDatabases(); } 
    catch (err) { alert('Failed to drop DB'); }
  };
  const handleAddFtpUser = async (e) => {
    e.preventDefault();
    if (!newFtpUser || !newFtpPass || !newFtpDomain) return alert('All fields required');
    try { await axios.post(`${API_BASE}/ftp`, { username: newFtpUser, password: newFtpPass, domain: newFtpDomain }); setNewFtpUser(''); setNewFtpPass(''); fetchFtpUsers(); } 
    catch (err) { alert('Failed to create FTP user'); }
  };
  const handleDeleteFtpUser = async (id) => {
    try { await axios.delete(`${API_BASE}/ftp/${id}`); fetchFtpUsers(); } 
    catch (err) { alert('Failed to drop FTP'); }
  };
  
  const handleAddUser = async (e) => {
    e.preventDefault();
    try { await axios.post(`${API_BASE}/users`, { username: newUser, password: newPass, role: newRole, package_id: selectedPackage }); setNewUser(''); setNewPass(''); fetchUsersList(); } 
    catch (err) { alert('Error: ' + (err.response?.data?.error || err.message)); }
  };
  const handleDeleteUser = async (id) => {
    try { await axios.delete(`${API_BASE}/users/${id}`); fetchUsersList(); } 
    catch (err) { alert('Failed to drop User'); }
  };

  const handleAddPackage = async (e) => {
    e.preventDefault();
    try { await axios.post(`${API_BASE}/packages`, { name: newPkgName, max_websites: newPkgWebs, max_databases: newPkgDbs, max_ftp_users: newPkgFtps }); setNewPkgName(''); fetchPackagesList(); } 
    catch (err) { alert('Failed to create Package'); }
  };
  const handleDeletePackage = async (id) => {
    try { await axios.delete(`${API_BASE}/packages/${id}`); fetchPackagesList(); } 
    catch (err) { alert('Failed to drop Pkg'); }
  };


  // --- Render Login ---
  if (!token) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-900 bg-gradient-to-br from-slate-900 to-primary-950">
        <div className="glass-panel p-8 w-full max-w-sm flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary-500 to-primary-400 flex items-center justify-center text-white shadow-xl shadow-primary-500/30 mb-6">
            <Server className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">AppServer</h1>
          <p className="text-slate-400 text-sm mb-6 text-center">Login to your control panel</p>
          
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
              {isLoggingIn ? <Loader2 className=" animate-spin h-5 w-5" /> : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- Render App ---
  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'websites', icon: Globe, label: 'Websites' },
    { id: 'databases', icon: Database, label: 'Databases' },
    { id: 'ftp', icon: FolderSync, label: 'FTP Accounts' }
  ];
  if (currentUser.role === 'admin' || currentUser.role === 'reseller') navItems.push({ id: 'users', icon: Users, label: 'Users & Sub-Accounts' });
  if (currentUser.role === 'admin') navItems.push({ id: 'packages', icon: Package, label: 'Hosting Packages' });
  navItems.push({ id: 'settings', icon: Settings, label: 'Settings' });

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
            <span className="text-xs font-semibold text-primary-500 uppercase tracking-widest">{currentUser.role}</span>
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
              <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-1 capitalize">{activeTab.replace('-', ' ')}</h1>
              <p className="text-slate-500 dark:text-slate-400">Manage your server resources beautifully.</p>
            </div>
          </header>

          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-6 hover:shadow-xl transition-all duration-300 group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 rounded-xl group-hover:scale-110 transition-transform"><Cpu className="h-6 w-6" /></div>
                    <span className="text-xs font-semibold text-blue-500 bg-blue-50 dark:bg-blue-500/10 px-2 py-1 rounded-full">Live</span>
                  </div>
                  <div>
                    <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">CPU Usage</h3>
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
                    <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">RAM Usage</h3>
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
                    <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Active Websites</h3>
                    <p className="text-3xl font-bold text-slate-800 dark:text-white flex items-end gap-2">
                       {websites.length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'websites' && (
            <div className="space-y-6">
              <div className="glass-panel p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white">Deployed Domains</h2>
                  <p className="text-sm text-slate-500">Add a new domain. Nginx routing is automatic.</p>
                </div>
                <form onSubmit={handleAddWebsite} className="flex gap-2 w-full md:w-auto">
                  <input type="text" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="example.com"
                    className="flex-1 md:w-64 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50 focus:ring-2 focus:ring-primary-500 outline-none" />
                  <button type="submit" className="btn-primary flex items-center gap-2"><Plus className="h-4 w-4" /> Add</button>
                </form>
              </div>

              <div className="glass-panel overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 dark:bg-dark-800/80 border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 uppercase text-xs font-semibold tracking-wider">
                    <tr><th className="px-6 py-4">Domain name</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Created</th><th className="px-6 py-4 text-right">Actions</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                    {websites.map(site => (
                      <tr key={site.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{site.domain}</td>
                        <td className="px-6 py-4"><span className="px-2.5 py-1 bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 rounded-full text-xs font-medium border border-green-200 dark:border-green-500/30">{site.status}</span></td>
                        <td className="px-6 py-4 text-slate-500 text-sm">{new Date(site.created_at).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                          {site.has_ssl ? (
                            <span className="p-2 text-green-500 rounded-lg flex items-center gap-1 text-sm font-medium"><ShieldCheck className="h-4 w-4" /> SSL</span>
                          ) : (
                            <button onClick={() => handleInstallSSL(site.id)} className="p-2 text-primary-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-colors flex items-center gap-1 text-sm" title="Install SSL"><ShieldCheck className="h-4 w-4" /> Install SSL</button>
                          )}
                          <button onClick={() => handleDeleteWebsite(site.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="h-5 w-5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                    <tr><th className="px-6 py-4">Database Name</th><th className="px-6 py-4">Assigned User</th><th className="px-6 py-4">Created Date</th><th className="px-6 py-4 text-right">Actions</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                    {databases.map(db => (
                      <tr key={db.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200 flex items-center gap-3"><Database className="h-5 w-5 text-slate-400" />{db.db_name}</td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{db.db_user}</td>
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

          {activeTab === 'ftp' && (
            <div className="space-y-6">
              <div className="glass-panel p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <form onSubmit={handleAddFtpUser} className="flex gap-2 w-full flex-wrap md:flex-nowrap">
                  <input type="text" value={newFtpUser} onChange={(e) => setNewFtpUser(e.target.value)} placeholder="Username" className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50 focus:ring-2 focus:ring-primary-500 outline-none w-full" />
                  <input type="password" value={newFtpPass} onChange={(e) => setNewFtpPass(e.target.value)} placeholder="Password" className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50 focus:ring-2 focus:ring-primary-500 outline-none w-full" />
                  <select value={newFtpDomain} onChange={(e) => setNewFtpDomain(e.target.value)} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50 focus:ring-2 focus:ring-primary-500 outline-none w-full">
                    <option value="">Select Domain</option>
                    {websites.map(w => <option key={w.id} value={w.domain}>{w.domain}</option>)}
                  </select>
                  <button type="submit" className="btn-primary flex items-center gap-2"><Plus className="h-4 w-4" /> Add</button>
                </form>
              </div>
              <div className="glass-panel overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 dark:bg-dark-800/80 border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 uppercase text-xs font-semibold tracking-wider">
                    <tr><th className="px-6 py-4">Username</th><th className="px-6 py-4">Linked Domain</th><th className="px-6 py-4">Created Date</th><th className="px-6 py-4 text-right">Actions</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                    {ftpUsers.map(user => (
                      <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200 flex items-center gap-3"><FolderSync className="h-5 w-5 text-slate-400" />{user.username}</td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{user.domain}</td>
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

          {activeTab === 'users' && (currentUser.role === 'admin' || currentUser.role === 'reseller') && (
            <div className="space-y-6">
              <div className="glass-panel p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <form onSubmit={handleAddUser} className="flex gap-2 w-full flex-wrap md:flex-nowrap">
                  <input type="text" value={newUser} onChange={(e) => setNewUser(e.target.value)} placeholder="Username" className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50 focus:ring-2 focus:ring-primary-500 outline-none w-full md:w-auto" required />
                  <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Password" className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50 focus:ring-2 focus:ring-primary-500 outline-none w-full md:w-auto" required />
                  
                  <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white/50 dark:bg-dark-800/50 focus:ring-2 focus:ring-primary-500 outline-none">
                    <option value="user">User</option>
                    {currentUser.role === 'admin' && <option value="reseller">Reseller</option>}
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
                    <tr><th className="px-6 py-4">Username</th><th className="px-6 py-4">Role</th><th className="px-6 py-4">Package ID</th><th className="px-6 py-4 text-right">Actions</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                    {usersList.map(user => (
                      <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{user.username} {user.id === currentUser.id && "(You)"}</td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300 uppercase text-xs font-bold">{user.role}</td>
                        <td className="px-6 py-4 text-slate-500 text-sm">{user.package_id || 'None'}</td>
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

          {activeTab === 'packages' && currentUser.role === 'admin' && (
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

          {activeTab === 'settings' && (
            <div className="glass-panel p-12 text-center text-slate-500">
              <Settings className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p>System settings configuration coming soon.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
