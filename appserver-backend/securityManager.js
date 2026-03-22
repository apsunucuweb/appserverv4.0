const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const isLinux = process.platform === 'linux';

async function runCmd(cmd) {
    if(!isLinux) {
        if(cmd.includes('status')) return `[MOCK OS] Windows Simulation Mode. Command: ${cmd}\nStatus: Active (Mock)`;
        return `[MOCK OS] Command Executed: ${cmd}\nSuccess.`;
    }
    try {
        const { stdout } = await execPromise(cmd);
        return stdout;
    } catch (e) {
        return `[ERROR] Executing command failed. Ensure the package is installed (e.g. ufw or fail2ban). Details: ${e.message}`;
    }
}

async function getFirewallStatus() { return await runCmd('ufw status numbered'); }
async function enableFirewall() { return await runCmd('echo y | ufw enable'); }
async function disableFirewall() { return await runCmd('ufw disable'); }
async function addFirewallRule(action, port, protocol) { return await runCmd(`ufw ${action} ${port}/${protocol || 'tcp'}`); }
async function deleteFirewallRule(ruleNum) { return await runCmd(`echo y | ufw delete ${ruleNum}`); }

async function getFail2BanStatus() { return await runCmd('fail2ban-client status'); }
async function getFail2BanJailStatus(jail) { return await runCmd(`fail2ban-client status ${jail}`); }
async function unbanIp(jail, ip) { return await runCmd(`fail2ban-client set ${jail} unbanip ${ip}`); }
async function banIp(jail, ip) { return await runCmd(`fail2ban-client set ${jail} banip ${ip}`); }

module.exports = {
   getFirewallStatus, enableFirewall, disableFirewall, addFirewallRule, deleteFirewallRule,
   getFail2BanStatus, getFail2BanJailStatus, unbanIp, banIp
};
