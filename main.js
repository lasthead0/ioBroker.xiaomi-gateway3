'use strict';

/* */
const utils = require('@iobroker/adapter-core');
const {isArray, isObject} = require('./lib/tools');
/* */
const crypto = require('crypto');
const mqtt = require('mqtt');
const format = require('date-fns/format');
/* */
const {fetchHashOfString} = require('./lib/utils');
/* */
const {MiioHelper, Gateway3Helper} = require('./lib/helpers');
const XiaomiCloud = require('./lib/xiaomiCloud');
const Gateway3 = require('./lib/gateway3');

global.sleepTimeouts = {};
global.bufferTimeouts = {};
global.stateSetterTimeouts = {};

class XiaomiGateway3 extends utils.Adapter {
    #mqttc = undefined;
    /* {error, debug} */
    #logBuffer = {};
    #_LOGGER = {
        'info': undefined,
        'error': undefined,
        'debug': undefined
    };

    constructor(options) {
        super(Object.assign(options || {}, {
            name: 'xiaomi-gateway3',
        }));

        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    set logger(l) {this.#_LOGGER = l}
    get logger() {return this.#_LOGGER}

    /* Adapter 'ready' event handler */
    async onReady() {
        /* Reset the connection indicator during startup */
	    this.setState('info.connection', false, true);
	    this.subscribeStates('*');

        /* Adapter logging options */
        const {cutSpam, debugLog, dLogAllTheRest, dLogMQTTLumi, dLogMQTTBle} = this.config;

        /* Adapter logger */
        this.logger = {
            'info': this.log.info,
            'error': (cutSpam => {
                if (cutSpam == false) {
                    return msg => this.log.error(msg);
                } else {
                    return msg => {
                        if (msg instanceof Error)
                            var hash = fetchHashOfString(msg.message);
                        else if (typeof msg == 'string')
                            var hash = fetchHashOfString(msg);
                        else
                            return;

                        if (this.#logBuffer[hash] != undefined) {
                            const {count} = this.#logBuffer[hash];
                            
                            this.#logBuffer[hash].count = count + 1;
                        } else {
                            this.log.error(msg);
                            
                            if (msg instanceof Error)
                                msg = msg.message;

                            this.#logBuffer[hash] = {message: msg, count: 0, first: Date.now()};

                            global.bufferTimeouts[hash] = setTimeout(() => {
                                const {message, count, first} = this.#logBuffer[hash];
                                
                                if (count > 0) {
                                    this.log.error(`^^^ ${count} identical errors occurred in the last 60 minutes. The first was at ${format(first, 'dd.MM.yyyy\'T\'HH:mm:ss.SSSxxx')}`);
                                    this.log.error(message);
                                }

                                this.#logBuffer[hash] = undefined;
                                delete this.#logBuffer[hash];
                            }, 3600000);
                        }
                    };
                }
            })(cutSpam),
            'debug': ((dLog, dLogAllTheRest, ...log) => {
                if (dLog) {
                    const [LUMI, BLE,] = log;

                    return msg => {
                        if (typeof msg === 'string') {
                            const logs = {LUMI, BLE};
                            const allowed = [(msg.match(/^\([\w]+\)/g) || [''])[0].match(/[A-Z]+/g)][0];

                            if (allowed != undefined) {
                                if (logs[allowed] == true)
                                    this.log.debug(msg);
                            } else {
                                if (dLogAllTheRest == true)
                                    this.log.debug(msg);
                            }
                        } else {
                            this.log.debug(msg);
                        }
                    };
                } else {
                    return () => {};
                }
            })(debugLog, dLogAllTheRest, dLogMQTTLumi, dLogMQTTBle)
        };

        /* */
        this.logger.info('Xiaomi Gateway 3 adapter loaded.');

        this.xiaomiCloud = new XiaomiCloud();
        this.xiaomiCloud.logger = this.logger;

        /* Initialize gateway3 */
        const {
            localip,
            token,
            telnetCmd,
            gwEnableTelnet,
            gwEnablePublicMqtt,
            gwLockFirmware,
            gwDisableBuzzer,
            gwInMemory,
            /* */
            debugOutput,
            msgReceivedStat
        } = this.config;

        this.gateway3 = new Gateway3(localip || '127.0.0.1', token || crypto.randomBytes(32).toString('hex'));
        this.gateway3.logger = this.logger;
        
        const gwConfig = {
            telnetCmd,
            gwEnableTelnet,
            gwEnablePublicMqtt,
            gwLockFirmware,
            gwDisableBuzzer,
            gwInMemory,
            /* */
            debugOutput,
            msgReceivedStat
        };

        const [enabledTelnet, enabledMqtt] = await this.gateway3.initialize(gwConfig, this._cbFindOrCreateDevice.bind(this));

        /* */
        if (enabledMqtt) {
            this.#mqttc = mqtt.connect(`mqtt://${localip}`);
            this.#mqttc.on('connect', this._onMqttConnect.bind(this));
            this.#mqttc.on('message', this._onMqttMessage.bind(this));
        }

        /* set adapter connection indicator */
        const connected = enabledTelnet && enabledMqtt;

        await this.setStateAsync('info.connection', connected, true);
    }

    /* Adapter 'stateChange' event handler */
    onStateChange(id, state) {
        const [_id, _state] = id.split('.').slice(-2);

        if (state != undefined && state.ack == false) {
            const {val, ts} = state;

            this.gateway3.sendMessage(_id, {[_state]: val}, this._cbSendMqttMessage.bind(this));
            this.setState(id, {val, ts, ack: true});
        } else if (state != undefined && state.ack == true) {
            //
        }
    }

    /* Adapter 'message' event handler */
    async onMessage(obj) {
        if (typeof obj === 'object' && obj.message) {
            const {from, command, message, callback} = obj;
            
            const handlers = {
                'GetGatewayFromCloud': this._msgGetGatewayFromCloud.bind(this),
                'GetMessagesStat': this._msgGetMessagesStat.bind(this),
                'ClearMessagesStat': this._msgClearMessagesStat.bind(this),
                'PingGateway3': this._msgPingGateway3.bind(this),
                'CheckTelnet': this._msgCheckTelnet.bind(this),
                'GetDevices': this._msgGetDevices.bind(this),
                'ModifyDeviceObject': this._msgModifyDeviceObject.bind(this),
                'SetStateValue': this._msgSetStateValue.bind(this),
            };

            await handlers[command](from, command, message, callback);
        }
    }

    /* Adapter 'unload' event handler */
    onUnload(callback) {
        try {
            this.setState('info.connection', false, true);

            /* clear timeouts */
            const timeouts = [].concat(
                Object.values(global.stateSetterTimeouts),
                Object.values(global.sleepTimeouts),
                Object.values(global.bufferTimeouts)
            );
            for (let t of timeouts)
                clearTimeout(t);

            /* close mqtt client */
            if (this.#mqttc != undefined)
                this.#mqttc.end();

            callback();
        } catch (error) {
            if (error)
                this.logger.error(`Unload error (${error.stack})`);

            this.sendError(error, `Unload error`);
            callback();
        }
    }

    /* 'GetGatewayFromCloud' message handler */
    async _msgGetGatewayFromCloud(from, command, message, callback) {
        const {email, password, server} = message;
                    
        const success = await this.xiaomiCloud.login(email, password);

        if (success) {
            const devices = await this.xiaomiCloud.getDevices(server);

            if (devices != undefined) {
                const gws = devices.filter(el => (el.model == 'lumi.gateway.mgl03' && el.isOnline == true));
                const msg = gws.map(el => (({model, token, localip}) => ({model, token, localip}))(el));
                
                if (callback) this.sendTo(from, command, msg, callback);
            } else {
                this.logger.error('ERROR: Failed getting devices.');
                if (callback) this.sendTo(from, command, 'ERROR: Failed getting devices', callback);
            }
        } else {
            // this.logger.error('ERROR: Xiaomi Cloud login fail!');
            if (callback) this.sendTo(from, command, 'ERROR: Xiaomi Cloud login fail!', callback);
        }
    }

    /* 'GetMessagesStat' message handler */
    async _msgGetMessagesStat(from, command, message, callback) {
        const devices = await this.getDevicesAsync();

        let msgStatObjects = [];

        for (let d of devices) {
            const state = await this.getStateAsync(`${d.native.id}.messages_stat`);

            if (state != undefined && String(state.val).match(/^\{.+\}$/gm) != undefined)
                msgStatObjects.push(Object.assign({}, {name: d.common.name}, JSON.parse(state.val)));
        }
        
        if (callback) this.sendTo(from, command, msgStatObjects, callback);
    }

    /* */
    async _msgClearMessagesStat(from, command, message, callback) {
        const devices = await this.getDevicesAsync();

        let msgStatObjects = [];

        for (let d of devices) {
            const _id = `${d.native.id}.messages_stat`;
            const state = await this.getStateAsync(_id);

            if (state != undefined)
                await this.setStateAsync(_id, null, true);
        }
        
        if (callback) this.sendTo(from, command, undefined, callback);
    }

    /* 'PingGateway3' message handler */
    async _msgPingGateway3(from, command, message, callback) {
        const {localip} = message;
        let avbl = false;

        if (localip != undefined) avbl = await MiioHelper.discover(localip);
        if (callback) this.sendTo(from, command, avbl, callback);
    }

    /* 'CheckTelnet' message handler */
    async _msgCheckTelnet(from, command, message, callback) {
        const {localip} = message;
        let avbl = false;

        if (localip != undefined) avbl = await Gateway3Helper.checkPort(23, localip);
        if (callback) this.sendTo(from, command, avbl, callback);
    }

    /* 'GetDevices' message handler */
    async _msgGetDevices(from, command, {dids}, callback) {
        const _devices = this.gateway3.devices;
        
        dids = dids || Object.keys(_devices);
        let devices1 = dids.map(_did => {
            const {mac, type, did, model, name, fwVer} = _devices[_did];

            return {
                id: String(mac).substr(2),
                mac,
                type,
                did,
                model,
                name,
                fwVer
            };
        });

        for (let device of devices1) {
            const {id} = device;

            const deviceObject = await this.getObjectAsync(id);
            
            if (deviceObject != undefined)
                device.friendlyName = deviceObject.common.name;

            /*  */
            const states = await this.getStatesAsync(`${id}*`);
            const stateVal = Object.keys(states)
                .map(s => s.split('.').splice(-1)[0])
                .reduce((obj, sn) => {
                    return Object.assign({}, obj, {[sn]: (states[`${this.namespace}.${id}.${sn}`] || {})['val']});
                }, {});

            device.stateVal = stateVal;

            /*  */
            const stateObject = await this.getObjectListAsync({
                startkey: `${this.namespace}.${id}.`,
                endkey: `${this.namespace}.${id}.\u9999`
            }).then(
                val => val.rows
                    .map(row => row.value)
                    .filter(el => el.common.custom == undefined
                        || el.common.custom[this.namespace] == undefined
                        || el.common.custom[this.namespace].showInCard == true
                    )
            );

            const stateCommon = {};
            for (const object of stateObject) {
                const sn = object['_id'].split('.').splice(-1)[0];
                const {common} = object;
                
                if (common != undefined) {
                    const {name, role, type, write, min, max, unit, states} = common;
                    
                    /* Select only useful fields of common */
                    stateCommon[sn] = {name, role, type, write, min, max, unit, states};
                }
            }

            device.stateCommon = stateCommon;
        }
        
        if (callback)
            this.sendTo(from, command, devices1, callback);
    }

    /* 'ModifyDeviceObject' message handler */
    async _msgModifyDeviceObject(from, command, message, callback) {
        const {id, object: common} = message;
        const _object = await this.getForeignObjectAsync(id);
        
        if (_object != undefined && common != undefined) {
            await this.setForeignObjectAsync(id, Object.assign(
                _object,
                {
                    from: `system.adapter.${this.namespace}`,
                    ts: Date.now()
                },
                {common: Object.assign(_object.common, common)}
            ));
        }
    }

    /* 'SetStateValue' message handler */
    async _msgSetStateValue(from, command, message, callback) {
        const {id, value} = message;

        await this.setStateAsync(id, value, false);
    }
    
    /* MQTT on 'connect' event callback */
    async _onMqttConnect() {
        this.#mqttc.subscribe('#');
    }

    /* MQTT on 'message' event callback */
    async _onMqttMessage(topic, message) {
        const RE_OBJECT = /^\{.+\}$/gm;

        try {
            if (String(message).match(RE_OBJECT) != undefined)
                var messageJSON = JSON.parse(message);
            /* */
            if (topic.match(/^zigbee\/send$/gm)) {
                this.logger.debug(`(_LUMI_) ${topic} ${message}`);
                if (messageJSON != undefined && isObject(messageJSON))
                    this.gateway3.processMessageLumi(messageJSON, this._cbProcessMessage.bind(this));
            }  else if (topic.match(/^log\/ble$/gm)) {
                this.logger.debug(`(_BLE_) ${topic} ${message}`);
                if (messageJSON != undefined && isObject(messageJSON))
                    this.gateway3.processMessageBle(messageJSON, this._cbProcessMessage.bind(this));
            }  else if (topic.match(/^log\/miio$/gm)) {
                // this.logger.debug(`${topic} ${message}`); //TODO:
                this.gateway3.processMessageLogMiio(message, this._cbProcessMessage.bind(this));
            } else if (topic.match(/\/heartbeat$/gm)) {
                //TODO: or not TODO:
                // Gateway heartbeats (don't handle for now)
            } else if (topic.match(/\/(MessageReceived|devicestatechange)$/gm)) {
                if (messageJSON != undefined && isObject(messageJSON))
                    this.gateway3.processMessageReceived(messageJSON, this._cbProcessMessage.bind(this));
            } else if (topic.match(/^zigbee\/recv$/gm)) {
                this.logger.debug(`(_LUMI_) ${topic} ${message}`);
            }
        } catch (e) {
            this.logger.error(e.stack);
        }
    }

    /* */
    async _cbProcessMessage(mac, payload) {
        const id = String(mac).substr(2);
        const states = await this.getStatesAsync(`${id}*`);

        /* Construct key-value object from current states */
        const deviceStateVal = Object.keys(states)
            .reduce((obj, s) => {
                const [sn,] = s.split('.').splice(-1);
                return Object.assign({}, obj, {[sn]: (states[s] || {})['val']});
            }, {});

        /* Construct key-value object from payload */
        const payloadStateVal = payload
            .filter(([, val]) => val != undefined)
            .reduce((obj, [state, val]) => Object.assign({}, obj, {[state.stateName]: val}), {});

        /*
         * Context build from current device states (and their values)
         * and new states from payload (and their values).
         * {
         *  stateName: [oldVal, newVal],
         *  ...
         * }
         * 
         * In some cases, opportunity to have current and new (from payload) state value can be useful.
         */
        const context = Object.assign({},
            Object.keys(deviceStateVal)
                .reduce((obj, key) => Object.assign({}, obj, {[key]: [deviceStateVal[key], payloadStateVal[key]]}), {}),
            Object.keys(payloadStateVal)
                .reduce((obj, key) => Object.assign({}, obj, {[key]: [deviceStateVal[key], payloadStateVal[key]]}), {})
        );

        for (let [state,] of payload) {
            /* << EOF
             * Have to try create Object here because I don't know specs for all bluetooth devices 
             * and can't create needed objects in _cbFindOrCreateDevice
             * TODO: FIXME:
             */
            const stateName = state.stateName;

            await this.setObjectNotExistsAsync(`${id}.${stateName}`, Object.assign({},
                {'_id': `${this.namespace}.${id}.${stateName}`},
                state.stateObject
            ));
            /* EOF */

            /* */
            const callback = async val => {await this.setStateAsync(`${id}.${stateName}`, val, true)};

            /* Execute state setter function for each state of payload */
            state.setter(id, callback, context, global.stateSetterTimeouts);
        }
    }

    /*
        Callback function which called by gateway initialization.
        It take device and create objects and states if needed.
    */
    async _cbFindOrCreateDevice(_device) {
        if (_device == undefined) return;

        const {mac, model, spec: deviceSpec, init} = _device;
        const objectId = String(mac).substr(2);

        /* set device (iob object) */
        await this.setObjectNotExistsAsync(objectId, {
            '_id': `${this.namespace}.${objectId}`,
            'type': 'device',
            'native': {
                'id': objectId
            },
            'common': {
                'name': model,
                'type': model
            }
        });

        /* Spec states names */
        const specStatesNames = [];

        /* */
        for (let state of deviceSpec) {
            const stateName = state.stateName;
            const _id = `${objectId}.${stateName}`;

            let stateObject = state.stateObject;
            const {custom} = stateObject.common;

            if (custom != undefined)
                stateObject.common.custom = {[this.namespace]: custom};

            /* create state object if it is not exist */
            await this.setObjectNotExistsAsync(_id, Object.assign({},
                {'_id': `${this.namespace}.${_id}`},
                stateObject
            ));
            
            /* set init state value if it is exist */
            const val = init[stateName];
            
            if (val != undefined) {
                const callback = async val => {await this.setStateAsync(_id, val, true)};

                /* Execute state setter function */
                state.setter(_id, callback, {[stateName]: [undefined, val]}, global.stateSetterTimeouts);
            }

            /* Collect states names */
            specStatesNames.push(stateName);
        }

        /* Delete ioBroker states (and objects) which have no mapped spec in device */
        const deviceStates = await this.getStatesOfAsync(`${objectId}`);
        const deviceStatesNames = deviceStates.map(({_id}) => (_id.split('.').slice(-1))[0]);

        for (let stateName of deviceStatesNames) {
            if (!specStatesNames.includes(stateName)) {
                const id = `${this.namespace}.${objectId}.${stateName}`;

                await this.deleteStateAsync(id);
                await this.delObjectAsync(id);
            }
        }
    }

    /* */
    async _cbSendMqttMessage(topic, msg) {
        this.#mqttc.publish(topic, msg);
    }
}

/* */
if (require.main !== module)
    module.exports = options => new XiaomiGateway3(options);
else
    new XiaomiGateway3();