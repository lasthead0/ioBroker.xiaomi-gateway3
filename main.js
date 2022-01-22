'use strict';

/* */
const utils = require('@iobroker/adapter-core');
/* */
const crypto = require('crypto');
const mqtt = require('mqtt');
/* */
const {MiioHelper, Gateway3Helper} = require('./lib/helpers');
const XiaomiCloud = require('./lib/xiaomiCloud');
const Gateway3 = require('./lib/gateway3');

global.sleepTimeouts = {};
global.stateSetterTimeouts = {};

class XiaomiGateway3 extends utils.Adapter {
    #mqttc = undefined;
    /* {error, debug} */
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
        const {debugLog, dLogAllTheRest, dLogMQTTLumi, dLogMQTTBle} = this.config;

        /* Adapter logger */
        this.logger = {
            'info': this.log.info,
            'error': this.log.error,
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
            this.gateway3.sendMessage(_id, {[_state]: state.val}, this._cbSendMqttMessage.bind(this));
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
            };

            await handlers[command](from, command, message, callback);
        }
    }

    /* Adapter 'unload' event handler */
    onUnload(callback) {
        try {
            this.setState('info.connection', false, true);

            /* clear timeouts */
            for (let t of [].concat(Object.values(global.stateSetterTimeouts), Object.values(global.sleepTimeouts)))
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
            this.logger.error('ERROR: Xiaomi Cloud login fail!');
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
    
    /* MQTT on 'connect' event callback */
    async _onMqttConnect() {
        this.#mqttc.subscribe('#');
    }

    /* MQTT on 'message' event callback */
    async _onMqttMessage(topic, msg) {
        if (String(msg).match(/^\{.+\}$/gm) != undefined) {
            try {
                const msgObject = JSON.parse(msg);

                /* */
                if (topic.match(/^zigbee\/send$/gm)) {
                    this.logger.debug(`(_LUMI_) ${topic} ${msg}`);
                    this.gateway3.processMessageLumi(msgObject, this._cbProcessMessage.bind(this));
                }  else if (topic.match(/^log\/ble$/gm)) {
                    this.logger.debug(`(_BLE_) ${topic} ${msg}`);
                    this.gateway3.processMessageBle(msgObject, this._cbProcessMessage.bind(this));
                }  else if (topic.match(/^log\/miio$/gm)) {
                    // TODO: or not TODO:
                } else if (topic.match(/\/heartbeat$/gm)) {
                    //TODO: or not TODO:
                    // Gateway heartbeats (don't handle for now)
                } else if (topic.match(/\/(MessageReceived|devicestatechange)$/gm)) {
                    this.gateway3.processMessageReceived(msgObject, this._cbProcessMessage.bind(this));
                } else if (topic.match(/^zigbee\/recv$/gm)) {
                    this.logger.debug(`(_LUMI_) ${topic} ${msg}`);
                }
            } catch (e) {
                this.logger.error(e.stack);
            }
        }
    }

    /* */
    async _cbProcessMessage(mac, payload) {
        const id = String(mac).substr(2);
        const states = await this.getStatesAsync(`${id}*`);

        /* Construct key-value object  from current states */
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
        for (let spec of deviceSpec) {
            const stateName = spec.stateName;

            /* create state object if it is not exist */
            await this.setObjectNotExistsAsync(`${objectId}.${stateName}`, Object.assign({},
                {'_id': `${this.namespace}.${objectId}.${stateName}`},
                spec.stateObject
            ));
            
            /* set init state value if it is exist */
            const val = init[stateName];
            
            if (val != undefined)
                await this.setStateAsync(`${objectId}.${stateName}`, val, true);

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