'use strict';

const Telnet = require('telnet-client');

/* */
const RE_VERSION = /version=[\d\._]+/gi;
const RE_DID = /did=[\d\._]+/gi;
const RE_MAC = /([\da-f]{2}[:-]){5}[\da-f]{2}/gi;

/* */
const FIRMWARE_PATH = ['/data/firmware.bin', '/data/firmware/firmware_ota.bin'];

// original link http://pkg.musl.cc/socat/mipsel-linux-musln32/bin/socat
// original link https://busybox.net/downloads/binaries/1.21.1/busybox-mipsel
const wget_url = (file, url) => `wget http://master.dl.sourceforge.net/project/mgl03/${url}?viasf=1 -O /data/${file} && chmod +x /data/${file}`;

/* */
const MD5_BUSYBOX = '099137899ece96f311ac5ab554ea6fec';
const MD5_GW3 = '1ae8ecbb6d054227ad32ca25e8a3a259';  // alpha
const MD5_SOCAT = '92b77e1a93c4f4377b4b751a5390d979';

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
    async _shellExec (func, ...args) {
        const shell = this.#shell;
        const connected = this.#connected;
        var recv = undefined;

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

    async _checkBin (file, md5, url = undefined) {
        return await this._shellExec(async (shell, ...args) => {
            const [file, md5, url] = args;
            const recv = await shell.exec(`md5sum /data/${file}`);

            if ((recv.match(/[A-Fa-f0-9]{32}/g) || []).includes(md5)) {
                return true;
            } else if (url != undefined) {
                await shell.send(wget_url(file, url), {waitfor: '# '});

                return await this._checkBin(file, md5);
            } else {
                return false;
            }
        }, file, md5, url);
    }

    /* Get running processes */
    async getRunningPs() {
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
            const lf = (file, lock) => `/data/busybox chattr ${lock ? '+i' : '-i'} ${file}`;

            if (await this._checkBin('busybox', MD5_BUSYBOX, 'bin/busybox')) {
                for (let path of FIRMWARE_PATH)
                    await shell.send(lf(path, lock), {waitfor: '# '});
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
};