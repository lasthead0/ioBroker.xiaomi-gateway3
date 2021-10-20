'use strict';

const Telnet = require('telnet-client');

/* */
const RE_VERSION = /version=[\d\._]+/gi;
const RE_DID = /did=[\d\._]+/gi;
const RE_MAC = /([\da-f]{2}[:-]){5}[\da-f]{2}/gi;

/* */
const FIRMWARE_PATH = ['/data/firmware.bin', '/data/firmware/firmware_ota.bin'];
const LOCK_FIRMWARE = (file, lock) => `/data/busybox chattr ${lock ? '+i' : '-i'} ${file}`;

// original link http://pkg.musl.cc/socat/mipsel-linux-musln32/bin/socat
// original link https://busybox.net/downloads/binaries/1.21.1/busybox-mipsel
/* wget command for download utils to /data directory */
const WGET = (file, url) => `wget -T 60 http://master.dl.sourceforge.net/project/mgl03/${url}?viasf=1 -O /data/${file} && chmod +x /data/${file}`;

/* use awk because buffer */
const MIIO_147 = 'miio_client -l 0 -o FILE_STORE -n 128 -d /data/miio';
const MIIO_146 = 'miio_client -l 4 -d /data/miio';
const MIIO2MQTT = pattern => `| awk '/${pattern}/{print $0;fflush()}' | mosquitto_pub -t log/miio -l &`;

/* */
const MD5_BUSYBOX = '099137899ece96f311ac5ab554ea6fec';
const MD5_SOCAT = '92b77e1a93c4f4377b4b751a5390d979';
// const MD5_GW3 = '1ae8ecbb6d054227ad32ca25e8a3a259';  // alpha

const MD5_BT = {
    '1.4.6_0012': '367bf0045d00c28f6bff8d4132b883de',
    '1.4.6_0043': 'c4fa99797438f21d0ae4a6c855b720d2',
    '1.4.7_0115': 'be4724fbc5223fcde60aff7f58ffea28',
    '1.4.7_0160': '9290241cd9f1892d2ba84074f07391d4',
    '1.5.0_0026': '9290241cd9f1892d2ba84074f07391d4',
    '1.5.0_0102': '9290241cd9f1892d2ba84074f07391d4',
};

/* */
function sleep(t) {
    return new Promise(r => setTimeout(() => r(true), t));
}

/* */
module.exports = class TelnetShell {
    #shell = undefined;
    #connected = false;
    #options = undefined;

    constructor(host, port = 23, timeout = 1500) {
        this.#options = {
            host,
            port,
            timeout,
            shellPrompt: '# ', // or negotiationMandatory: false
            loginPrompt: 'login: ',
            username: 'admin',
            password: '',
            initialLFCR: true,
            debug: true
        };

        this.#shell = new Telnet();
        this.#shell.on('ready', () => {
            this.#connected = true;
        });
        this.#shell.on('end', () => {
            this.#connected = false;
        });
        this.#shell.on('close', () => {
            this.#connected = false;
        });
    }

    /* Common function */
    async _shellExec(func, ...args) {
        const shell = this.#shell;
        const connected = this.#connected;
        let recv = undefined;

        try {
            if (!connected) await shell.connect(this.#options);
            recv = await func(shell, ...args);
        } catch (err) {
            console.error(err);
        } finally {
            if (!connected) {
                await shell.end();
                await sleep(500);
            }
            
            return recv;
        }
    }

    /* check binary by given md5 and download if not exist */
    async _checkBin(file, md5, url = undefined) {
        return await this._shellExec(async (shell, ...args) => {
            const [file, md5, url] = args;
            const recv = await shell.exec(`md5sum /data/${file}`);

            if ((recv.match(/[A-Fa-f0-9]{32}/g) || []).includes(md5)) {
                return true;
            } else if (url != undefined) {
                await shell.send(WGET(file, url), {waitfor: '# '});

                return await this._checkBin(file, md5);
            } else {
                return false;
            }
        }, file, md5, url);
    }

    /* Get running processes */
    async getRunningProcesses() {
        return await this._shellExec(async shell => {
            return await shell.exec(`ps -w`);
        });
    }

    /* Read file by file name (full path) */
    async readFile(file, base64 = false) {
        return await this._shellExec(async (shell, ...args) => {
            const [file, base64] = args;

            if (base64) {
                let recv = await shell.exec(`cat ${file} | base64`);
                return Buffer.from(recv, 'base64').toString();
            } else {
                return await shell.exec(`cat ${file}`);
            }
        }, file, base64);
    }

    /* Check (md5) fixed bt binaries and download if needed */
    async checkBt(ver) {
        return await this._shellExec(async (shell, ...args) => {
            const [ver] = args;
            const md5 = MD5_BT[ver];

            if (md5 != undefined)
                return await this._checkBin('silabs_ncp_bt', md5, `${md5}/silabs_ncp_bt`);
            else
                return false;
        }, ver);
    }

    /* Run fixed binaries */
    async runBt() {
        await this._shellExec(async shell => {
            await shell.send(
                'killall silabs_ncp_bt; pkill -f log/ble; \
                /data/silabs_ncp_bt /dev/ttyS1 1 2>&1 >/dev/null | \
                mosquitto_pub -t log/ble -l &',
                {waitfor: '# '}
            ); 
        });
    }

    /* */
    async redirectMiio2Mqtt(ver, pattern) {
        await this._shellExec(async (shell, ...args) => {
            const [ver, pattern] = args;
            const cmd = ('1.4.6_0063'.localeCompare(ver, 'en-US-u-kn-true') < 0) ? MIIO_147 : MIIO_146;
            
            await shell.exec('killall daemon_miio.sh');
            await sleep(500);
            await shell.exec('killall miio_client; pkill -f log/miio');
            await sleep(500);
            await shell.exec(`${cmd} ${MIIO2MQTT(pattern)}`);
            await sleep(500);
            await shell.exec('daemon_miio.sh &');
        }, ver, pattern);
    }

    /* Kill mosquito binded to 127.0.0.1 and run binded to all interfaces */
    async runPublicMosquitto() {
        await this._shellExec(async shell => {
            await shell.send(`killall mosquitto`, {waitfor: '# '});
            await sleep(500);
            await shell.send(`mosquitto -d`, {waitfor: '# '});
            await sleep(500);
            // fix CPU 90% full time bug
            await shell.send(`killall zigbee_gw`, {waitfor: '# '});
        });
    }

    /* Checking is firmware files locked and creating they if not exists */
    async checkFirmwareLock() {
        return await this._shellExec(async shell => {
            let r = [];

            await shell.send('mkdir -p /data/firmware', {waitfor: '# '});
            for (let path of FIRMWARE_PATH) {
                let recv = await shell.exec(`touch ${path}`);

                r.push(recv.match('Permission denied') != null);
            }

            return r.reduce((pr, cr) => pr && cr, true);
        });
    }

    /* Lock (true)(chattr +i) or unlock (false)(chattr +i) firmware update by set firmware files as immutable */
    async lockFirmware(lock) {
        await this._shellExec(async (shell, ...args) => {
            const [lock] = args;

            if (await this._checkBin('busybox', MD5_BUSYBOX, 'bin/busybox')) {
                for (let path of FIRMWARE_PATH)
                    await shell.send(LOCK_FIRMWARE(path, lock), {waitfor: '# '});
            }
        }, lock);
    }

    /* Stop (true) or run (false) buzzer */
    async stopBuzzer(stop) {
        await this._shellExec(async (shell, ...args) => {
            const [stop] = args;

            if (stop == true) {
                /* stop buzzer */
                await shell.send('killall daemon_miio.sh; killall -9 basic_gw', {waitfor: '# '});
                await sleep(500);
                await shell.send('sh -c \'sleep 999d\' dummy:basic_gw &', {waitfor: '# '});
                await sleep(500);
                await shell.send('daemon_miio.sh &', {waitfor: '# '});
            } else {
                /* run buzzer */
                await shell.send('kill $(ps | grep dummy:basic_gw | awk \'{print $1}\')', {waitfor: '# '});
            }
        }, stop);
    }

    /* Get firmware version */
    async getFwVersion() {
        return await this._shellExec(async shell => {
            let recv = await shell.exec('cat /etc/rootfs_fw_info');

            return String(recv).match(RE_VERSION)[0].substr(8);
        });
    }

    /* Get gw token */
    async getToken() {
        return await this._shellExec(async shell => {
            let recv = await shell.exec('cat /data/miio/device.token');

            return Buffer.from(recv.replace(/(\r\n|\n|\r)/g, '')).toString('hex');
        });
    }

    /* Get gw did (device id) */
    async getDid() {
        return await this._shellExec(async shell => {
            let recv = await shell.exec('cat /data/miio/device.conf');

            return String(recv).match(RE_DID)[0].substr(4);
        });
    }

    /* Get wlan mac */
    async getWlanMac() {
        return await this._shellExec(async shell => {
            let recv = await shell.exec('cat /sys/class/net/wlan0/address');

            return String(recv).match(RE_MAC)[0].toUpperCase();
        });
    }

    /* */
    // def run_zigbee_tcp(self, port=8888):
    // def stop_zigbee_tcp(self):
    // def run_lumi_zigbee(self):
    // def stop_lumi_zigbee(self):
    // def run_ftp(self):
    // def run_public_zb_console(self):
    // def run_ntpd(self):
};