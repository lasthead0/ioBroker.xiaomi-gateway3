const miioProtocol = require('js-miio-simple');
const TelnetShell = require('./shell');
/* */
const {isObject, isArray} = require('./tools');
const {reverseMac} = require('./utils');
const {SQLite} = require('./utilsdb');
const {Gateway3Helper} = require('./helpers');
const Zigbee = require('./zigbee');
const Bluetooth = require('./bluetooth');

/* */
const MIN_SUPPORTED_VERSION = '1.4.7_0000';

/* */
const TELNET_CMD = '{"id":0,"method":"enable_telnet_service", "params":[]}';
// const TELNET_CMD = '{"id":0,"method":"set_ip_info","params":{"ssid":"\\"\\"","pswd":"123123 ; passwd -d admin ; echo enable > /sys/class/tty/tty/enable; telnetd"}}';

/* */
function sleep(t) {
    return new Promise(r => setTimeout(() => r(true), t));
}

/* Basic class for Xiaomi Devices */
class XiaomiDevice {
    #did = ''; // str  # unique Xiaomi did
    #mac = ''; // str
    #type = '' // str  # gateway, zigbee, ble, mesh
    #model = ''; // str  # Xiaomi model
    #specLUMI = undefined;
    #specMIOT = undefined;

    constructor({did, model, mac, type, specLUMI, specMIOT}) {
        this.#did = did || '';
        this.#mac = mac || '';
        this.#type = type || '';
        this.#model = model || '';
        this.#specLUMI = specLUMI;
        this.#specMIOT = specMIOT;
    }

    set did(v) {this.#did = v}
    get did() {return this.#did}

    set mac(v) {this.#mac = v}
    get mac() {return this.#mac}

    set type(v) {this.#type = v}
    get type() {return this.#type}

    set model(v) {this.#model = v}
    get model() {return this.#model}

    set specLUMI(v) {this.#specLUMI = v}
    get specLUMI() {return this.#specLUMI}

    set specMIOT(v) {this.#specMIOT = v}
    get specMIOT() {return this.#specMIOT}
}

/* */
class Gateway3 extends XiaomiDevice {
    /* {error, debug} */
    #_LOGGER = {
        info: () => {},
        error: () => {},
        debug: () => {}
    };

    #shell = undefined;
    devices = {};

    /* Xiaomi Gateway own properties*/
    #localip = '';
    #token = '';
    #fw_version = '';
    /* */
    topic = '';

    constructor(ip, token) {
        super({});

        this.#localip = ip;
        this.#token = token;
        this.#shell = new TelnetShell(ip);
    }

    set logger(l) {this.#_LOGGER = l}
    get logger() {return this.#_LOGGER}

    /* Initialize gateway3 with config */
    async initialize(config, cb) {
        let return1 = [true, true];
        const {telnetCmd, gwEnablePublicMqtt, gwLockFirmware, gwStopBuzzer} = config;
        const openTelnetCmd = (telnetCmd == undefined || telnetCmd == '') ? TELNET_CMD : telnetCmd;

        /* Check telnet port (23) and try open if not opened */
        if (await this._checkPort(23) != true && await this._enableTelnet(openTelnetCmd) != true) {
            this.logger.error('ERROR: Can\'t open telnet on device');

            return [false, false];
        } else {
            this.#fw_version = await this.#shell.getFwVersion();
            
            if (MIN_SUPPORTED_VERSION.localeCompare(this.#fw_version, 'en-US-u-kn-true') > 0) {
                this.logger.error(`Adapter not supported firmware version ${this.#fw_version}`);

                return [false, false];
            }

            /* get processes */
            const ps = await this.#shell.getRunningProcesses();

            /* Enable public Mosquitto */
            if (await this._checkPort(1883) == true) {
                this.logger.debug(`Public Mosquitto (MQTT) enabled`);
            } else if (await this._checkPort(1883) != true && gwEnablePublicMqtt == true) {
                await this.#shell.runPublicMosquitto();
                await sleep(1000);
                if (await this._checkPort(1883) != true) {
                    this.logger.error(`ERROR: Can't enable public Mosquitto (MQTT)`);
                    return1 = [true, false];
                } else {
                    this.logger.debug(`Public Mosquitto (MQTT) enabled`);
                }
            }

            /* */
            if (await this.#shell.checkBt(this.#fw_version)) {
                if (ps.match(/\-t log\/ble/g) == undefined) {
                    await this.#shell.runBt();
                    this.logger.debug(`Run fixed BT`);
                } else {
                    this.logger.debug(`Fixed BT already running`);
                }
            } else {
                this.logger.debug(`Fixed BT isn't supported`);
            }

            /* */
            if (ps.match(/\-t log\/miio/g) == undefined) {
                // all data or only necessary events
                // pattern = (
                //     '\\{"' if 'miio' in self.debug_mode else
                //     "ot_agent_recv_handler_one.+"
                //     "ble_event|properties_changed|heartbeat"
                // )
                const pattern = 'ot_agent_recv_handler_one.+ble_event|properties_changed|heartbeat';

                await this.#shell.redirectMiio2Mqtt(this.#fw_version, pattern);
                this.logger.debug('Redirect miio to MQTT');
            }
            
            /* Lock or unlock firmware */
            if (typeof gwLockFirmware == 'boolean' && await this.#shell.checkFirmwareLock() != gwLockFirmware)
                await this.#shell.lockFirmware(gwLockFirmware);
            this.logger.debug(`Firmware update (firmware files) ${gwLockFirmware ? '' : 'un'}locked`);

            /* Stop or start buzzer */
            if (typeof gwStopBuzzer == 'boolean' && (ps.match(/dummy\:basic_gw/g) == undefined) == gwStopBuzzer)
                await this.#shell.stopBuzzer(gwStopBuzzer);
            this.logger.debug(`Buzzer ${gwStopBuzzer ? 'stopped' : 'started'}`);

            /* Get and install devices */
            const _devices = await this._getDevices();

            if (_devices != undefined && _devices.length != 0)
                this._setupDevices(_devices, cb);

            /* Info output after initialize sequence done */
            this.logger.info(`Xiaomi Gateway3 (${this.#localip}) firmware version = ${this.#fw_version}`);
            
            /* */
            return return1;
        }
    }

    /* */
    async _getDevices() {
        let devices = [];

        try {
            /* 1. Read coordinator info */
            let raw = await this.#shell.readFile('/data/zigbee/coordinator.info');

            let device = JSON.parse(raw);
            const {name, lumi_spec: specLUMI, miot_spec: specMIOT} = Zigbee.getDevice('lumi.gateway.mgl03');

            devices.push({
                'did': await this.#shell.getDid(),
                'mac': device['mac'],
                'type': 'gateway',
                'model': 'lumi.gateway.mgl03',
                name,
                'fw_ver': this.#fw_version,
                'wlan_mac': await this.#shell.getWlanMac(),
                specLUMI,
                specMIOT
            });
        } catch (e) {
            this.logger.error(e);
        }

        /* 2. Read zigbee devices */
        if (true) {
            try {
                const raw = await this.#shell.readFile('/data/zigbee/device.info');
                const lumiZigbeeDevices = JSON.parse(raw)['devInfo'];

                /* */
                const zigbeeDevices = await (async dids => {
                    const raw = await this.#shell.readFile(this.zigbeeDataBaseFile);
                    const zigbeeDevices = JSON.parse(String(raw).replace(/\}\s*\{/g, ', '));
                    
                    return dids.reduce((p, c) => {
                        return Object.assign({}, p, {[c]: JSON.parse(zigbeeDevices[`${c}.prop`]).props});
                    }, {});
                })(lumiZigbeeDevices.map(el => el.did));

                for (let lumi of lumiZigbeeDevices) {
                    const {did, mac, model: zigbeeModel, shortId: nwk, appVer, hardVer, model_ver: modelVer} = lumi;
                    
                    /* Get Zigbee device description by model */
                    const desc = Zigbee.getDevice(zigbeeModel);

                    if (desc == undefined) {
                        this.logger.error(`${did} has an unsupported Zigbee model: ${zigbeeModel}`);
                        continue;
                    }

                    const {name, model, lumi_spec: specLUMI, miot_spec: specMIOT} = desc;
                    const retain = zigbeeDevices[did];

                    if (retain == undefined) {
                        this.logger.error(`${did} is not in the Xiaomi database`);
                        continue;
                    }

                    /* Get params which have relations between 'spec' and 'retain' (will use on init) */
                    const params = [].concat(specLUMI || [], specMIOT || []).reduce((p, [, prop, state]) => {
                        return Object.assign({}, p, {[state]: retain[prop]});
                    }, {}) || {};

                    devices.push({
                        did,
                        mac,
                        nwk,
                        'type': 'zigbee',
                        model,
                        name,
                        'fwVer': appVer,
                        'hwVer': hardVer,
                        'modelVer': modelVer,
                        specLUMI,
                        specMIOT,
                        'init': Zigbee.fixXiaomiProps(zigbeeModel, params)
                    });
                }
            } catch (e) {
                this.logger.error(e);
            }
        }
        
        /* 3. Read bluetooth devices */
        if (true) {
            try {
                const raw = await this.#shell.readFile('/data/miio/mible_local.db', true);

                const db = new SQLite(raw);
                const rows = db.readTable('gateway_authed_table');
                
                for (let row of rows) {
                    const [, mac, bluetoothModel, , did] = row;
                    const desc = Bluetooth.getDevice(bluetoothModel);

                    if (desc == undefined) {
                        this.logger.error(`${did} has an unsupported Bluetooth model: ${bluetoothModel}`);
                        continue;
                    }

                    const {model, lumi_spec: specLUMI} = desc;

                    devices.push({
                        did,
                        'mac': `0x${reverseMac(row[1])}`,
                        'type': 'ble',
                        model,
                        specLUMI
                        // 'init': {}
                    });
                }
            } catch (e) {
                this.logger.error(e);
            }
        }
        
        /* */
        return devices;
    }

    /* */
    _setupDevices(_devices, findOrCreateDevice) {
        for (let _device of _devices) {
            const {did, mac, type, model, name, specLUMI, specMIOT, init} = _device;
            
            this.devices[did] = new XiaomiDevice({did, mac, type, model, specLUMI, specMIOT});
            if (type == 'gateway') {
                this.did = did;
                this.topic = `gw/${String(mac).substr(2).toUpperCase()}/`;
            } else {
                findOrCreateDevice({
                    mac,
                    model,
                    specs: (specLUMI || specMIOT || []).map(el => el[2]).filter(el => el != undefined),
                    init: init || {}
                });
            }
        }
    }

    /* Process messages from zigbee devices */
    processMessageZigbee(message, cb) {
        const {cmd} = message;
        let pkey;

        if (cmd == 'heartbeat') {
            if (message['params'].length == 1) {
                message = message['params'][0];
                pkey = 'res_list';
            } else {
                return;
            }
        } else if (cmd == 'report') {
            pkey = message['params'] != undefined ? 'params' : 'mi_spec';
        } else if (['write_rsp', 'read_rsp'].includes(cmd)) {
            pkey = message['results'] != undefined ? 'results' : 'mi_spec';
        } else if (cmd == 'write_ack') {
            return;
        } else {
            this.logger.warning(`Unsupported cmd: ${message}`);
            
            return;
        }

        let did = message['did'] != 'lumi.0' ? message['did'] : this.did;
        
        /* Double check device existance  */
        if (!Object.keys(this.devices).includes(did) || !Object.keys(message).includes(pkey)) return;

        const {mac, model, specLUMI, specMIOT} = this.devices[did];

        const paramsKeyVal = message[pkey].reduce((pv, cv) => {
            if (cv['error_code'] || 0 != 0) return pv;

            let prop;

            if (Object.keys(cv).includes('res_name')) {
                prop = cv['res_name'];
            } else if (Object.keys(cv).includes('piid')) {
                prop = `${cv['siid']}.${cv['piid']}`;
            } else if (Object.keys(cv).includes('eiid')) {
                prop = `${cv['siid']}.${cv['eiid']}`;
            } else {
                this.logger.error(`Unsupported param: ${JSON.stringify(message)}`);

                return undefined;
            }

            const [s] = ((specLUMI || specMIOT || []).find(el => el[0] == prop) || Array(3).fill(undefined)).slice(-1);

            const val = (() => {
                if (Object.keys(cv).includes('value')) {
                    return Zigbee.fixXiaomiProps(model, {[s]: cv.value})[s];
                } else if (Object.keys(cv).includes('arguments')) {
                    /* how does this work?? */
                    try {
                        const d = JSON.parse(prop);

                        if (typeof d === 'object')
                            Object.assign({}, pv, d);
                        else                     
                            return cv.arguments;
                    } catch (e) {
                        return cv.arguments;
                    }
                }
            })();

            return Object.assign({}, pv, s != undefined ? {[s]: val} : {});
        }, {});

        /* Don't update states for gateway, because I make this logic  ?? what i mean ??*/
        if (did != this.did) {
            const payload = (specLUMI || specMIOT || []).reduce((p, c) => {
                return Object.assign({}, p, {[c[2]]: paramsKeyVal[c[2]]});
            }, {});
    
            payload.available = 1;

            cb(mac, payload);
        }
    }

    processMessageBle(message, cb) {
        const {did, eid, edata, pdid, seq} = message;

        if (!Object.keys(this.devices).includes(did)) {
            this.logger.error(`Unknown BLE device did = ${did}`);
            
            return;
        }

        const {mac, seq: _seq} = this.devices[did];

        if (_seq == seq)
            return;
        this.devices[did]['seq'] = seq;
        
        const payload = Bluetooth.parseXiaomiBle({eid, edata, pdid});

        if (payload != undefined)
            cb(mac, payload);
    }

    sendMessage(id, states /* object */, cb) {
        const device = Object.values(this.devices).find(el => el.mac == `0x${id}`);
        const {type} = device || {}; //FIXME: Will fix some day

        /* Supported ONLY (or not?) for Zigbee devices for now */
        //TODO: For all devices if possible
        if (device != undefined && type == 'zigbee') {
            const {did} = device;
            const {specLUMI, specMIOT} = device;
            let payload = {'cmd': 'write', 'did': did};

            if (isObject(states)) {
                const params = Object.keys(states)
                    .map(state => {
                        const [prop,] = ((specLUMI || specMIOT || []).find(el => el[2] == state) || [undefined]);
                        const value = states[state];

                        if (prop == undefined) {
                            return undefined;
                        } else {
                            if (specMIOT != undefined) {
                                const [siid, piid] = prop.split('.').slice(0, 1);
                                return {siid, piid, value};
                            } else {
                                return {'res_name': prop, value};
                            }
                        }
                    })
                    .filter(p => p != undefined);
                
                payload[(specMIOT != undefined ? 'mi_spec' : 'params')] = params;
            }

            cb('zigbee/recv', JSON.stringify(payload));
        }
    }

    /* Check is gateway3 port open or not */
    async _checkPort(port) {
        return Gateway3Helper.checkPort(port, this.#localip);
    }

    /* Open telnet on gateway3 with miIO */
    async _enableTelnet(cmd) {
        const miIO = new miioProtocol(this.#localip, this.#token, () => true);
        
        const [avbl] = await miIO.discover();

        if (avbl) {
            const [awr, msg] = await miIO.cmdSend(JSON.parse(cmd));

            if (awr == true)
                return (JSON.parse(msg[1])['result'] == 'ok');
            else
                return false;
        } else {
            return false;
        }
    }

    get zigbeeDataBaseFile() {
        // https://github.com/AlexxIT/XiaomiGateway3/issues/14
        // fw 1.4.6_0012 and below have one zigbee_gw.db file
        // fw 1.4.6_0030 have many json files in this folder
        if ('1.4.6_0030'.localeCompare(this.#fw_version, 'en-US-u-kn-true') <= 0)
            return '/data/zigbee_gw/*.json';
        else
            throw new Error('Unsupported firmware version. Can\'t get zigbee devices DB.');
            // return '/data/zigbee_gw/zigbee_gw.db';
    }

    get meshGroupTable() {
        if ('1.4.7_0160'.localeCompare(this.#fw_version, 'en-US-u-kn-true') <= 0)
            return 'mesh_group_v3';
        else if ('1.4.6_0043'.localeCompare(this.#fw_version, 'en-US-u-kn-true') <= 0)
            return 'mesh_group_v1';
        else
            return 'mesh_group';
    }

    get meshDeviceTable() {
        if ('1.4.7_0160'.localeCompare(this.#fw_version, 'en-US-u-kn-true') <= 0)
            return 'mesh_device_v3';
        else
            return 'mesh_device';
    }
};

module.exports = Gateway3;