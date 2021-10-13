const miioProtocol = require('js-miio-simple');
const TelnetShell = require('./shell');
/* */
const {Gateway3Helper} = require('./helpers');
const {isObject, isArray} = require('./tools');
const Zigbee = require('./zigbee');

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
        'error': () => {},
        'debug': () => {}
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
            this.logger.info(`Xiaomi Gateway3 (${this.#localip}) firmware version = ${this.#fw_version}`);

            /* Enable public Mosquitto */
            if (await this._checkPort(1883) == true) {
                this.logger.debug(`Public Mosquitto (MQTT) enabled`);
            } else if (await this._checkPort(1883) != true && gwEnablePublicMqtt == true) {
                await this.#shell.runPublicMosquitto();
                await sleep(1000);
                if (await this._checkPort(1883) != true) {
                    this.logger.error('ERROR: Can\'t enable public Mosquitto (MQTT)');
                    
                    return1 = [true, false];
                } else {
                    this.logger.debug(`Public Mosquitto (MQTT) enabled`);
                }
            }

            /* Lock or unlock firmware */
            if (gwLockFirmware != undefined && typeof (await this.#shell.checkFirmwareLock()) == 'boolean') {
                await this.#shell.lockFirmware(gwLockFirmware);
                this.logger.debug(`Firmware update (firmware files) ${gwLockFirmware ? '' : 'un'}locked`);
            } // TODO: add else with warning

            /* Stop or start buzzer */
            if (gwStopBuzzer != undefined && typeof gwStopBuzzer == 'boolean') {
                await this.#shell.stopBuzzer(gwStopBuzzer);
                this.logger.debug(`Buzzer ${gwStopBuzzer ? 'stopped' : 'started'}`);
            } // TODO: add else with warning

            /* Get and install devices */
            const _devices = await this._getDevices();

            if (_devices != undefined && _devices.length != 0)
                this._setupDevices(_devices, cb);
            // this.logger.debug(JSON.stringify(_devices)); //debug

            /* */
            return return1;
        }
    }

    /* */
    async _getDevices() {
        let devices = [];

        /* 1. Read coordinator info */
        try {
            let raw = await this.#shell.readFile('/data/zigbee/coordinator.info');
            let device = JSON.parse(raw);

            const {name, lumi_spec: specLUMI, miot_spec: specMIOT} = Zigbee.getDeviceByModel('lumi.gateway.mgl03');

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
            this.logger.error(`Can't get gateway info from /data/zigbee/coordinator.info`);

            return undefined;
        }

        /* 2. Read zigbee devices */
        /* Now work only for fw >= 1.4.6_0030 */
        let zigbeeDevices;

        if (0 == 1) {
            // TODO: for fw < 1.4.6_0030
        } else {
            try {
                let raw = await this.#shell.readFile(this.zigbeeDatabaseFile, true);

                raw = String(raw).replace(/\}\s*\{/g, '}, {');
                zigbeeDevices = JSON.parse(`[${raw}]`);
            } catch (e) {
                zigbeeDevices = [{'dev_list': 'null'}];
            }
        }

        const didZigbeeDevices = JSON.parse(zigbeeDevices[0]['dev_list'] || '[]');

        for (let did of didZigbeeDevices) {
            const device = zigbeeDevices.find(el => Object.keys(el).includes(`${did}.mac`));

            /* Get device model by did */
            const model = device[`${did}.model`];

            if (model == undefined) {
                this.logger.error(`${model} has not in devices DB`);
                continue;
            }

            /* Get Zigbee device description by model */
            const desc = Zigbee.getDeviceByModel(model);

            if (desc == undefined) {
                this.logger.error(`${did} has an unsupported modell: ${model}`);
                continue;
            }
            const {name, lumi_spec: specLUMI, miot_spec: specMIOT} = desc;

            const retain = JSON.parse(device[`${did}.prop`]).props;
            /* Get params which have relations between 'spec' and 'retain' (will use on init) */
            let params = {};

            for (let [, prop, state] of [].concat(specLUMI || [], specMIOT || [])) {
                if (prop != undefined && retain[prop] != undefined) 
                    params[state] = retain[prop];
            }

            let ieee = String(`0000${device[`${did}.mac`]}`).slice(-16);

            devices.push({
                'did': did,
                'mac': `0x${device[`${did}.mac`]}`,
                'type': 'zigbee',
                model,
                name,
                'fw_ver': retain['fw_ver'],
                'ieee': ieee,
                // 'nwk': nwks.get(ieee),
                specLUMI,
                specMIOT,
                'init': Zigbee.fixXiaomiProps(model, params)
            });
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
                    name,
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

        /* Don't update states for gateway, because I make this logic */
        if (did != this.did) {
            const payload = (specLUMI || specMIOT || []).reduce((p, c) => {
                return Object.assign({}, p, {[c[2]]: paramsKeyVal[c[2]]});
            }, {});
    
            payload.available = true;

            cb(mac, payload);
        }
    }

    sendMessage(id, states /* object */, cb) {
        const device = Object.values(this.devices).find(el => el.mac == `0x${id}`);

        if (device != undefined) {
            const {did} = device;
            const {specLUMI, specMIOT} = device;
            let payload = {'cmd': 'write', 'did': did};

            if (isObject(states)) {
                const params = Object.keys(states)
                    .map(state => {
                        const [prop,] = ((specLUMI || []).find(el => el[2] == state) || [undefined]);

                        if (prop == undefined) {
                            return undefined;
                        } else {
                            if (specMIOT != undefined) {
                                const [siid, piid] = String().split('.').slice(0, 1);

                                return {siid, piid, 'value': states[state]};
                            } else {
                                return {'res_name': prop, 'value': states[state]};
                            }
                        }
                    })
                    .filter(p => p != undefined);
                
                payload[(specMIOT != undefined ? 'mi_spec' : 'params')] = params;
            }

            // this.logger.debug(JSON.stringify(payload)); //debug
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

    get zigbeeDatabaseFile() {
        // https://github.com/AlexxIT/XiaomiGateway3/issues/14
        // fw 1.4.6_0012 and below have one zigbee_gw.db file
        // fw 1.4.6_0030 have many json files in this folder
        if (String(this.#fw_version).localeCompare('1.4.6_0030') >= 0) return '/data/zigbee_gw/*.json';
        else return '/data/zigbee_gw/zigbee_gw.db';
    }

    get meshGroupTable() {
        if (String(this.#fw_version).localeCompare('1.4.6_0160') >= 0)
            return 'mesh_group_v3';
        else if (String(this.#fw_version).localeCompare('1.4.6_0043') >= 0)
            return 'mesh_group_v1';
        else
            return 'mesh_group';
    }

    get meshDeviceTable() {
        if (String(this.#fw_version).localeCompare('1.4.6_0160') >= 0)
            return 'mesh_device_v3';
        else
            return 'mesh_device';
    }
};

module.exports = Gateway3;

/* 
[
    {"away_dev_list":"null","dev_list":"[\"lumi.158d00045fc9b3\",\"lumi.158d00047eb223\"]","home_dev_list":"null","sleep_dev_list":"null"},
    {"lumi.158d00045fc9b3.mac":"158d00045fc9b3","lumi.158d00045fc9b3.model":"lumi.sensor_motion.aq2","lumi.158d00045fc9b3.prop":"{\"props\":{\"CCA\":1,\"alive\":1,\"battery\":74,\"battery_end_of_life\":0,\"chip_temperature\":30,\"cur_state\":1,\"fw_ver\":\"1.0.0_0000\",\"hw_ver\":0,\"illumination\":26,\"lqi\":255,\"lux\":26,\"no_motion_sec\":120,\"parent\":\"\",\"power_tx\":10,\"pre_state\":0,\"pv_state\":0,\"report_period\":60,\"reset_cnt\":12,\"security_state\":false,\"send_all_cnt\":0,\"send_fail_cnt\":0,\"send_retry_cnt\":0,\"voltage\":3045}}","lumi.158d00045fc9b3.version":"1.2"},
    {"lumi.158d00047eb223.mac":"158d00047eb223","lumi.158d00047eb223.model":"lumi.sensor_motion.aq2","lumi.158d00047eb223.prop":"{\"props\":{\"CCA\":1,\"alive\":1,\"battery\":70,\"battery_end_of_life\":0,\"chip_temperature\":33,\"cur_state\":1,\"fw_ver\":\"1.0.0_0000\",\"hw_ver\":0,\"illumination\":45,\"lqi\":220,\"lux\":45,\"no_motion_sec\":120,\"parent\":\"\",\"power_tx\":10,\"pre_state\":0,\"pv_state\":0,\"report_period\":60,\"reset_cnt\":135,\"security_state\":false,\"send_all_cnt\":0,\"send_fail_cnt\":0,\"send_retry_cnt\":0,\"voltage\":3025}}","lumi.158d00047eb223.version":"1.2"}
]
*/

/*
{"cmd":"write","did":"lumi.0","id":17,"params":[{"res_name":"8.0.2082","value":"lumi.158d0003a4e536"}],"source":"","time":1632059551217}
{"cmd":"write_rsp","id":17,"time":1632059551542,"did":"lumi.0","zseq":0,"results":[{"res_name":"8.0.2082","value":"lumi.158d0003a4e536","error_code":0}]}
{"cmd":"report","id":2000000380,"did":"lumi.0","dev_src":"0","zseq":0,"params":[{"res_name":"8.0.2084","value":{"did":"lumi.158d0003a4e536","mac":"158d0003a4e536","model":"lumi.plug.v1","version":"34","zb_ver":"1.2","joined_type":1}}]}
*/