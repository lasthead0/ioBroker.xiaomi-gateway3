'use strict';

const dateFormat = require('date-fns/format');
/* */
const miioProtocol = require('js-miio-simple');

/* */
const {
    TelnetShell,
    DB_ZIGBEE,
    DB_BLUETOOTH,
    PATCH_MIIO_MQTT,
    PATCH_BLETOOTH_MQTT,
    PATCH_BUZZER,
    PATCH_DISABLE_BUZZER,
    PATCH_MEMORY_ZIGBEE1,
    PATCH_MEMORY_ZIGBEE2,
    PATCH_MEMORY_ZIGBEE3,
    PATCH_MEMORY_BLUETOOTH1,
    PATCH_MEMORY_BLUETOOTH2,
    PATCH_MEMORY_BLUETOOTH3
} = require('./shell');

/* */
const {isObject, isArray} = require('./tools');
const {reverseMac, sleep} = require('./utils');
const {SQLite} = require('./utilsdb');
const {Gateway3Helper} = require('./helpers');
const Lumi = require('./lumi');
const Bluetooth = require('./bluetooth');

/* */
const MIN_SUPPORTED_VERSION = '1.4.7_0000';

/* */
const TELNET_CMD = '{"id":0,"method":"enable_telnet_service", "params":[]}';
// const TELNET_CMD = '{"id":0,"method":"set_ip_info","params":{"ssid":"\\"\\"","pswd":"123123 ; passwd -d admin ; echo enable > /sys/class/tty/tty/enable; telnetd"}}';

/* */
class XiaomiDeviceStat {
    #lastSeq1 = undefined;
    #lastSeq2 = undefined;
    #lastRst = undefined;

    #nwk = '';
    #received = 0;
    #missed = 0;
    #unresponsive = 0;
    #linkQuality = 0;
    #rssi = 0;
    #lastMissed = 0;
    #lastSeen = '';

    constructor (resetCnt = 0) {
        this.#lastRst = resetCnt;
    }

    get object() {
        return {
            nwk: this.#nwk,
            received: this.#received,
            missed: this.#missed,
            unresponsive: this.#unresponsive,
            lqi: this.#linkQuality,
            rssi: this.#rssi,
            lastSeen: this.#lastSeen
        };
    }

    update(message) {
        if (message['sourceAddress'] != undefined) {
            const {
                sourceAddress,
                APSCounter,
                APSPlayload,
                rssi,
                linkQuality
            } = message;

            this.#nwk = sourceAddress;
            this.#linkQuality = linkQuality;
            this.#rssi = rssi;
            this.#received += 1;
            
            try {
                const newSeq1 = Number(APSCounter);
                
                const manufact = Number(`0x${APSPlayload.substr(2, 2)}`) & 4;
                const newSeq2 = Number(`0x${manufact ? APSPlayload.substr(8, 2) : APSPlayload.substr(4, 2)}`);

                if (this.#lastSeq1 != undefined && newSeq2 != 0) {
                    let miss = Math.min(
                        (newSeq1 - this.#lastSeq1 - 1) & 0xFF,
                        (newSeq2 - this.#lastSeq2 - 1) & 0xFF
                    );

                    this.#missed += miss;
                    this.#lastMissed = miss;
                }

                this.#lastSeq1 = newSeq1;
                this.#lastSeq2 = newSeq2;

            } catch (e) {
                this.logger.error(e);
            }

            this.#lastSeen = dateFormat(Date.now(), 'yyyy-MM-dd\'T\'HH:mm:ssxxx');
        } else if (message['ago'] != undefined) {
            // TODO: or not TODO:
        } else if (message['parent'] != undefined) {
            // TODO: or not TODO:
        } else if (message['alive'] != undefined) {
            // TODO: or not TODO:
        } else if (message['reset_cnt'] != undefined) {
            this.#lastRst = message['reset_cnt'];
        } else if (message['deviceState'] == 17) {
            this.#unresponsive +=  1;
        }
    }
}

/* Basic class for Xiaomi Devices */
class XiaomiDevice {
    #did = ''; // str  # unique Xiaomi did
    #mac = ''; // str
    #type = ''; // str  # gateway, zigbee, lumi, ble, mesh
    #model = ''; // str  # Xiaomi model
    #fwVer = '';
    #spec = undefined;
    #stat = undefined;

    constructor({did, mac, type, model, fwVer, spec, stat}) {
        this.#did = did || '';
        this.#mac = mac || '';
        this.#type = type || '';
        this.#model = model || '';
        this.#fwVer = fwVer || '';
        this.#spec = spec;
        this.#stat = stat;
    }

    set did(v) {this.#did = v}
    get did() {return this.#did}

    set mac(v) {this.#mac = v}
    get mac() {return this.#mac}

    set type(v) {this.#type = v}
    get type() {return this.#type}

    set model(v) {this.#model = v}
    get model() {return this.#model}

    set spec(v) {this.#spec = v}
    get spec() {return this.#spec}

    get stat() {return this.#stat};
}

/* */
class Gateway3 extends XiaomiDevice {
    /* {info, error, debug} */
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
        this.#shell = new TelnetShell(ip, 23, 3000);
    }

    set logger(l) {this.#_LOGGER = l}
    get logger() {return this.#_LOGGER}

    /* Initialize gateway3 with config */
    async initialize(config, cb) {
        let return1 = [true, true];
        const {
            telnetCmd,
            gwEnablePublicMqtt,
            gwLockFirmware,
            gwDisableBuzzer,
            gwInMemory,
        } = config;
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
            let patchesMiio = [PATCH_MIIO_MQTT, PATCH_BUZZER];
            let patchesApp = [];

            if (await this.#shell.checkBt()) {
                this.logger.debug('Patch Bluetooth (BLE)');
                
                patchesMiio = [].concat(patchesMiio, [PATCH_BLETOOTH_MQTT]);
            } else {
                this.logger.debug(`Fixed BT isn't supported`);
            }

            if (typeof gwDisableBuzzer == 'boolean' && gwDisableBuzzer) {
                this.logger.debug('Annoying buzzer signals disabled');

                patchesMiio = [].concat(patchesMiio, [PATCH_DISABLE_BUZZER]);
            } else {
                this.logger.debug('All buzzer signals enabled');
            }

            /* Patches for 'storage in memory' */
            if (typeof gwInMemory == 'boolean' && gwInMemory) {
                patchesApp = [].concat(patchesApp, [
                    PATCH_MEMORY_ZIGBEE1,
                    PATCH_MEMORY_ZIGBEE2,
                    PATCH_MEMORY_ZIGBEE3
                ]);

                if (patchesMiio.includes(PATCH_BLETOOTH_MQTT)) {
                    patchesMiio = [].concat(patchesMiio, [
                        PATCH_MEMORY_BLUETOOTH1,
                        PATCH_MEMORY_BLUETOOTH2,
                        PATCH_MEMORY_BLUETOOTH3
                    ]);
                }
            }

            /* Apply patches and run daemon_app.sh */
            if (await this.#shell.runDaemonApp(patchesApp))
            /* if was runned new instatnce of daemon_app.sh */
                this.logger.debug(`Patch daemon_app.sh with ${patchesApp.length}`);

            /* Apply patches and run daemon_miio.sh */
            if (await this.#shell.runDaemonMiio(patchesMiio))
                /* if was runned new instatnce of daemon_miio.sh */
                this.logger.debug(`Patch daemon_miio.sh with ${patchesMiio.length}`);

            /* Lock or unlock firmware */
            if (typeof gwLockFirmware == 'boolean' && await this.#shell.checkFirmwareLock() != gwLockFirmware)
                await this.#shell.lockFirmware(gwLockFirmware);
            this.logger.debug(`Firmware update (firmware files) ${gwLockFirmware ? '' : 'un'}locked`);

            /* Get gateway devices */
            const _devices = await this._getDevices();

            /* Filter optional states by adapter settings */
            const {
                debugOutput,
                msgReceivedStat
            } = config;

            const excludedStates = (obj => {
                const statesNames = {
                    'debugOutput': 'debug_output',
                    'msgReceivedStat': 'messages_stat'
                };
        
                return Object.keys(obj)
                    .map(key => obj[key] == false ? statesNames[key] : undefined)
                    .filter(el => el != undefined);
            })({debugOutput, msgReceivedStat});

            _devices.forEach(_device => {
                _device.spec.forEach(([, , state], idx) => {
                    if (excludedStates.includes(state.stateName))
                        _device.spec[idx] = undefined;
                });
            });

            /* Setup devices */
            if (_devices != undefined && _devices.length != 0)
                this._setupDevices(_devices, cb);

            /* Logging loaded devices count */
            const {lumi: lumi1, ble: ble1} = Object.values(this.devices)
                .filter(d => d.type != 'gateway')
                .reduce((acc, device) => {
                    const {type} = device;
                    return Object.assign(acc, {[type]: [].concat(acc[type], device)});
                }, {lumi: [], ble: []});

            this.logger.info(`Loaded devices: lumi - ${lumi1.length}, ble - ${ble1.length}`);
            
            /* Logging list of loaded devices */
            for (const d of [].concat(lumi1, ble1))
                this.logger.debug(`${d.type.toUpperCase()}: ${d.model} - DID: ${d.did}`);

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
            const {name, spec} = Lumi.getDevice('lumi.gateway.mgl03');

            devices.push({
                'did': await this.#shell.getDid(),
                'mac': device['mac'],
                'type': 'gateway',
                'model': 'lumi.gateway.mgl03',
                name,
                'fwVer': this.#fw_version,
                'wlan_mac': await this.#shell.getWlanMac(),
                spec
            });
        } catch (e) {
            this.logger.error(e);
        }

        /* 2. Read zigbee devices */
        // TODO: Add 'zigbee' option or remove IF block
        if (true) {
            try {
                const raw = await this.#shell.readFile('/data/zigbee/device.info');
                const lumiZigbeeDevices = JSON.parse(raw)['devInfo'];

                /* */
                const lumiDevices = await (async dids => {
                    const raw = await this.#shell.readFile(DB_ZIGBEE);
                    const lumiDevices = JSON.parse(String(raw).replace(/\}\s*\{/g, ', '));
                    
                    return dids.reduce((p, c) => {
                        return Object.assign({}, p, {[c]: JSON.parse(lumiDevices[`${c}.prop`]).props});
                    }, {});
                })(lumiZigbeeDevices.map(el => el.did));

                for (let lumi of lumiZigbeeDevices) {
                    const {did, mac, model: lumiModel, shortId: nwk, appVer, hardVer, model_ver: modelVer} = lumi;
                    
                    /* Get Lumi zigbee device description by model */
                    const desc = Lumi.getDevice(lumiModel);

                    if (desc == undefined) {
                        this.logger.error(`${did} has an unsupported Lumi zigbee model: ${lumiModel}`);
                        continue;
                    }

                    const {name, model, spec} = desc;
                    const retain = lumiDevices[did];

                    if (retain == undefined) {
                        this.logger.error(`${did} is not in the Xiaomi database`);
                        continue;
                    }

                    /* Get params which have relations between 'spec' and 'retain' (will use on init) */
                    const params = spec.reduce((p, [, prop, state]) => {
                        return Object.assign({}, p, {[state.stateName]: state.normalizeLeft(/* val */retain[prop])});
                    }, {}) || {};

                    devices.push({
                        did,
                        mac,
                        nwk,
                        'type': 'lumi',
                        model,
                        name,
                        'fwVer': appVer,
                        'hwVer': hardVer,
                        'modelVer': modelVer,
                        spec,
                        'init': Object.assign({},
                            params,
                            {resetCnt: retain['reset_cnt']}
                        )
                    });
                }
            } catch (e) {
                this.logger.error(e);
            }
        }
        
        /* 3. Read bluetooth devices */
        // TODO: Add 'bluetooth' option or remove IF block
        if (true) {
            try {
                const raw = await this.#shell.readFile(DB_BLUETOOTH, true);

                const db = new SQLite(raw);
                const rows = db.readTable('gateway_authed_table');
                
                for (let row of rows) {
                    const [, mac, bluetoothModel, , did] = row;
                    const desc = Bluetooth.getDevice(bluetoothModel);

                    if (desc == undefined) {
                        this.logger.error(`${did} has an unsupported Bluetooth model: ${bluetoothModel}`);
                        continue;
                    }

                    const {model, spec} = desc;

                    devices.push({
                        did,
                        'mac': `0x${reverseMac(row[1])}`,
                        'type': 'ble',
                        model,
                        spec
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
            const {did, mac, type, model, name, fwVer, spec, init} = _device;
            const {resetCnt} = init || {};
            const filteredSpec = (spec != undefined ? spec.filter(s => s != undefined) : []);
            
            this.devices[did] = new XiaomiDevice({
                did,
                mac,
                type,
                model,
                fwVer,
                spec: filteredSpec.map(el => [el[0], el[2]]),
                stat: new XiaomiDeviceStat(resetCnt)
            });

            if (type == 'gateway') {
                this.did = did;
                this.topic = `gw/${String(mac).substr(2).toUpperCase()}/`;
            } else {
                findOrCreateDevice({
                    mac,
                    model,
                    spec: filteredSpec.map(el => el[2]).filter(el => el != undefined),
                    init: init || {}
                });
            }
        }
    }

    /* Process messages from Lumi zigbee devices */
    processMessageLumi(message, cb, cbd) {
        const {cmd} = message;
        let did = message['did'] != 'lumi.0' ? message['did'] : this.did;
        
        // from AlexxIT/XiaomiGateway3
        // cmd:
        // - heartbeat - from power device every 5-10 min, from battery - 55 min
        // - report - new state from device
        // - read, write - action from Hass, MiHome or Gateway software
        // - read_rsp, write_rsp - gateway execute command (device may not
        //   receive it)
        // - write_ack - response from device (device receive command)
        if (cmd == 'heartbeat') {
            message = message['params'][0];
        } else if (cmd == 'write_rsp') {
            if (did != 'lumi.0')
                return;
        } else if (['report', 'read_rsp'].includes(cmd)) {
            //pass
        } else if (cmd == 'write_ack') {
            return;
        } else {
            this.logger.warning(`Unsupported cmd: ${message}`);
            
            return;
        }
        
        if (!Object.keys(this.devices).includes(did))
            return;

        const {mac, model, spec: deviceSpec} = this.devices[did];

        const paramsKeyVal = Object.keys(message).reduce((p, pkey) => {
            if (['res_list', 'params', 'results', 'mi_spec'].includes(pkey) == false)
                return p;

            const pKeyVal = message[pkey]
                .map(param => {
                    if (param['error_code'] || 0 != 0) return undefined;

                    let prop;

                    if (Object.keys(param).includes('res_name')) {
                        prop = param['res_name'];
                    } else if (Object.keys(param).includes('piid')) {
                        prop = `${param['siid']}.${param['piid']}`;
                    } else if (Object.keys(param).includes('eiid')) {
                        prop = `${param['siid']}.${param['eiid']}`;
                    } else {
                        this.logger.error(`Unsupported param: ${JSON.stringify(message)}`);

                        return undefined;
                    }

                    if (Object.keys(param).includes('value'))
                        return [prop, param.value];
                    else
                        return undefined;
                })
                .filter(spec => spec != undefined);

            return [].concat(p, pKeyVal);
        }, []);

        /* << EOF Common part for `processMessageLumi` and `processMessageBle` */
        const statesKeyVal = deviceSpec
            .reduce((pv, [, state]) => Object.assign({}, pv, state.decode(paramsKeyVal)), {});

        const statesNames = Object.keys(statesKeyVal)
            .reduce((p, c) => {
                return [].concat(p, deviceSpec
                    .filter(([, state]) => state.dependsOn.includes(c))
                    .map(([, state]) => state.stateName)
                );
            }, [])
            .concat(Object.keys(statesKeyVal));

        const payload = deviceSpec
            .filter(([, state]) => [...new Set(statesNames)].includes(state.stateName))
            .map(([, state]) => [state, statesKeyVal[state.stateName]]);
        /* EOF */

        cb(mac, payload);
    }

    /* Process messages from BLE devices */
    processMessageBle(message, cb, cbd) {
        const {did, eid, edata, pdid, seq} = message;

        if (!Object.keys(this.devices).includes(did)) {
            this.logger.error(`Unknown BLE device did = ${did}`);
            
            return;
        }

        const {mac, model, spec: deviceSpec, seq: _seq} = this.devices[did];

        if (_seq == seq)
            return;
        this.devices[did]['seq'] = seq;

        const paramsKeyVal = [[eid, edata]];

        /* << EOF Common part for `processMessageLumi` and `processMessageBle` */
        const statesKeyVal = deviceSpec
            .reduce((pv, [, state]) => Object.assign({}, pv, state.decode(paramsKeyVal)), {});

        const statesNames = Object.keys(statesKeyVal)
            .reduce((p, c) => {
                return [].concat(p, deviceSpec
                    .filter(([, state]) => state.dependsOn.includes(c))
                    .map(([, state]) => state.stateName)
                );
            }, [])
            .concat(Object.keys(statesKeyVal));

        const payload = deviceSpec
            .filter(([, state]) => [...new Set(statesNames)].includes(state.stateName))
            .map(([, state]) => [state, statesKeyVal[state.stateName]]);
        /* EOF */

        /**
         * Have to call `parseXiaomiBle` for case if device have no defined spec
         * TODO: FIXME:
         */
        if (payload.length == 0)
            (Bluetooth.parseXiaomiBle({eid, edata, pdid}) || []).forEach(el => payload.push(el));

        cb(mac, payload);
    }

    /* */
    sendMessage(id, /* object */states, cb) {
        const device = Object.values(this.devices).find(el => el.mac == `0x${id}`);
        const {type} = device || {}; //FIXME: Will fix some day

        /* Supported ONLY (or not?) for lumi and zigbee devices for now */
        //TODO: For all devices if possible
        if (device != undefined && ['lumi', 'zigbee'].includes(type)) {
            const {did, spec} = device;
            let payload = {'cmd': 'write', 'did': did};

            if (isObject(states)) {
                const changedStates = Object.keys(states)
                    .map(_state => {
                        return (spec.find(([, state]) => state.stateName == _state) || [undefined]);
                    })
                    .filter(s => s != undefined);

                changedStates
                    .map(([,state]) => state.encode(states[state.stateName]))
                    .filter(s => s != undefined)
                    .forEach(params => {
                        Object.keys(params).forEach(paramKey => {
                            payload[paramKey]  = [].concat(payload[paramKey] || [], params[paramKey] || []);
                        });
                    });
            }

            cb('zigbee/recv', JSON.stringify(payload));
        }
    }

    /* */
    processMessageReceived(message, cb) {
        const {eui64} = message;
        const did = `lumi.${eui64.replace(/\b0x0+/g, '').toLowerCase()}`;
        const device = this.devices[did];

        const payload = [];

        if (device != undefined && device.stat != undefined) {
            device.stat.update(message);

            const [, statState] = (device.spec.find(([, state]) => state.stateName == 'messages_stat') || []);

            if (statState != undefined) {
                const stat = Object.assign({}, device.stat.object, {did});

                payload.push([statState, statState.normalizeLeft(stat)]);
            }
        }

        cb(device.mac, payload);
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