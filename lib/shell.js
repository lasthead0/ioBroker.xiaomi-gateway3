'use strict';

const crypto = require('crypto');
const Telnet = require('telnet-client');

const {isArray} = require('./tools');

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

/* */
const MD5_BUSYBOX = '099137899ece96f311ac5ab554ea6fec';
// const MD5_GW3 = '1ae8ecbb6d054227ad32ca25e8a3a259';  // alpha

const MD5_BT = {
    '1.4.7_0115': 'be4724fbc5223fcde60aff7f58ffea28',
    '1.4.7_0160': '9290241cd9f1892d2ba84074f07391d4',
    '1.5.0_0026': '9290241cd9f1892d2ba84074f07391d4',
    '1.5.0_0102': '9290241cd9f1892d2ba84074f07391d4',
};

/* sed with extended regex and edit file in-place */
const PATCH1 = (p0, p1, p2) => {
    p2 = String(p2).replace(/\$/g, '\\$')
        .replace(/&/g, '\\&')
        .replace(/=/g, '\\=')
        .replace(/`/g, '\\`')
        .replace(/"/g, '\\"')
        .replace(/\\n/g, '\\\\n');

    return `sed -r "s=${p1}=${p2}=" -i /tmp/daemon_${p0}.sh`;
};

/* */
const PATCH_MIIO_MQTT = PATCH1(
    'miio', '^ +miio_client .+$',
    'miio_client -l 0 -o FILE_STORE -d $MIIO_PATH -n 128 | awk \'/ot_agent_recv_handler_one.+(ble_event|properties_changed|heartbeat)/{print $0;fflush()}\' | mosquitto_pub -t log/miio -l &'
);
const PATCH_BLETOOTH_MQTT = PATCH1(
    'miio', '^ +silabs_ncp_bt .+$',
    '/data/silabs_ncp_bt /dev/ttyS1 $RESTORE 2>&1 >/dev/null | mosquitto_pub -t log/ble -l &'
);

/* */
function sleep(t) {
    return new Promise(r => setTimeout(() => r(true), t));
}

/* */
class TelnetShell {
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
            if (!connected)
                await shell.connect(this.#options);

            return await func(shell, ...args);
        } catch (err) {
            throw err;
        } finally {
            if (!connected) {
                await shell.end();
                await sleep(500);
            }
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
                await shell.exec(WGET(file, url));

                return await this._checkBin(file, md5);
            } else {
                return false;
            }
        }, file, md5, url);
    }

    /* Read file by file name (full path) */
    async readFile(file, base64 = false) {
        return await this._shellExec(async (shell, ...args) => {
            const [file, base64] = args;

            let recv = await shell.exec(`cat ${file}${base64 ? ' | base64' : ''}`);

            if (recv.match(/No such file or directory/g) != null)
                throw new Error(recv);

            if (base64) {
                /* return binary data as ArrayBuffer (array of bytes) */
                try {
                    return Buffer.from(recv, 'base64').buffer;
                } catch (e) {
                    throw new Error('Can\'t get ArrayBuffer from base64');
                }
            } else {
                return recv;
            }
        }, file, base64);
    }

    /* Get running processes */
    async getRunningProcesses(grep) {
        return await this._shellExec(async (shell, ...args) => {
            const [grep] = args;

            if (grep != undefined)
                return await shell.exec(`ps -ww | grep '${grep}' | grep -v grep`);
            else
                return await shell.exec(`ps -ww | grep -v ' 0 SW'`);
        }, grep);
    }

    /* Check (md5) fixed bt binaries and download if needed */
    async checkBt() {
        return await this._shellExec(async shell => {
            const ver = await this.getFwVersion();
            const md5 = MD5_BT[ver];

            if (md5 != undefined)
                return await this._checkBin('silabs_ncp_bt', md5, `${md5}/silabs_ncp_bt`);
            else
                return false;
        });
    }

    /* */
    async runDaemonMiio(patches) {
        return await this._shellExec(async (shell, ...args) => {
            const [patches] = args;

            const miioPs = () => {
                if (isArray(patches) && patches.length != 0)
                    return crypto.createHash('md5').update(patches.join('\n')).digest('hex').toUpperCase();
                else
                    return '/bin/daemon_miio.sh';
            };

            if (await this.getRunningProcesses(miioPs()) == '') {
                await shell.exec('killall daemon_miio.sh');
                await sleep(500);
                await shell.exec(`killall miio_client silabs_ncp_bt; pkill -f 'log/ble|log/miio'`);
                //killall miio_client silabs_ncp_bt; killall -9 basic_gw; pkill -f 'log/ble|log/miio' //FIXME:
                await sleep(500);

                if (isArray(patches) && patches.length != 0) {
                    await shell.exec('cp /bin/daemon_miio.sh /tmp');

                    for (let patch of patches)
                        await shell.exec(patch);

                    await shell.exec(`/tmp/daemon_miio.sh ${miioPs()} &`);
                } else {
                    await shell.exec('daemon_miio.sh &');
                }

                return true;
            } else {
                return false;
            }
        }, patches);
    }

    /* Kill mosquito binded to 127.0.0.1 and run binded to all interfaces */
    async runPublicMosquitto() {
        await this._shellExec(async shell => {
            await shell.exec(`killall mosquitto`);
            await sleep(500);
            await shell.exec(`mosquitto -d`);
            await sleep(500);
            // fix CPU 90% full time bug
            await shell.exec(`killall zigbee_gw`);
        });
    }

    /* Checking is firmware files locked and creating they if not exists */
    async checkFirmwareLock() {
        return await this._shellExec(async shell => {
            let r = [];

            await shell.exec('mkdir -p /data/firmware');
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
                    await shell.exec(LOCK_FIRMWARE(path, lock));
            }
        }, lock);
    }

    /* Stop (true) or run (false) buzzer */
    async stopBuzzer(stop) {
        await this._shellExec(async (shell, ...args) => {
            const [stop] = args;

            if (stop == true) {
                /* stop buzzer */
                await shell.exec('killall daemon_miio.sh; killall -9 basic_gw');
                await sleep(500);
                await shell.exec('sh -c \'sleep 999d\' dummy:basic_gw &');
                await sleep(500);
                await shell.exec('daemon_miio.sh &');
            } else {
                /* run buzzer */
                await shell.exec('kill $(ps | grep dummy:basic_gw | awk \'{print $1}\')');
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

module.exports = {
    TelnetShell,
    PATCH_MIIO_MQTT,
    PATCH_BLETOOTH_MQTT
};