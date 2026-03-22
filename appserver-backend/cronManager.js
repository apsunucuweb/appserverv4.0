const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const isLinux = process.platform === 'linux';
const CRON_FILE = isLinux ? '/etc/cron.d/appserver_crons' : path.join(__dirname, 'mock_cron_d');

async function regenerateCrons(allCronRecords) {
    if (!isLinux) {
        if (!fs.existsSync(path.dirname(CRON_FILE))) fs.mkdirSync(path.dirname(CRON_FILE), { recursive: true });
    }

    let content = '# AppServer Auto-Generated Crontab\n';
    content += '# DO NOT EDIT MANUALLY\n\n';
    content += 'SHELL=/bin/bash\nPATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin\n\n';

    allCronRecords.forEach(c => {
        // Format: min hour day month weekday user command
        content += `${c.minute} ${c.hour} ${c.day} ${c.month} ${c.weekday} root ${c.command} >/dev/null 2>&1\n`;
    });

    content += '\n'; // Cron files need trailing newline

    fs.writeFileSync(CRON_FILE, content);

    if (isLinux) {
        try {
            // cron.d auto-refreshes, but reloading is safe
            await execPromise('systemctl reload cron || systemctl reload crond');
        } catch (e) {
            console.log('Cron reload (optional) note: ', e.message);
        }
    }
    return true;
}

module.exports = { regenerateCrons };
