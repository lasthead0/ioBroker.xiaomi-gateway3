'use strict';

/* */
const utils = require('@iobroker/adapter-core');
/* */
const crypto = require('crypto');
const mqtt = require('mqtt');
/* */
const {MiioHelper, Gateway3Helper, ioBrokerHelper: iob} = require('./lib/helpers');
const XiaomiCloud = require('./lib/xiaomi_cloud');
const Gateway3 = require('./lib/gateway3');

class XiaomiGateway3 extends utils.Adapter {
    #mqttc = undefined;
    /* {error, debug} */
    #_LOGGER = {
        'info': undefined,
        'error': undefined,
        'debug': undefined
    };

    #timers = {};

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

    get timers() {return this.#timers};

    /* Adapter 'ready' event handler */
    async onReady() {
        /* Reset the connection indicator during startup */
	    this.setState('info.connection', false, true);
	    this.subscribeStates('*');

        /* Adapter logging options */
        const {debugLog, dLogMQTT} = this.config;

        /* Adapter logger */
        this.logger = {
            'info': this.log.info,
            'error': this.log.error,
            'debug': (([d, ...log]) => {
                if (d) {
                    const [MQTT,] = log;

                    return msg => {
                        if (typeof msg === 'string') {
                            const logs = {MQTT};
                            const allowed = [(msg.match(/^\([\w]+\)/g) || [''])[0].match(/[A-Z]+/g)][0];

                            if (allowed != undefined) {
                                if (logs[allowed] == true)
                                    this.log.debug(msg);
                            } else {
                                this.log.debug(msg);
                            }
                        } else {
                            this.log.debug(msg);
                        }
                    };
                } else {
                    return () => {};
                }
            })([debugLog, dLogMQTT])
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
            gwStopBuzzer
        } = this.config;

        this.gateway3 = new Gateway3(localip || '127.0.0.1', token || crypto.randomBytes(32).toString('hex'));
        this.gateway3.logger = this.logger;
        
        const gwConfig = {
            telnetCmd,
            gwEnableTelnet,
            gwEnablePublicMqtt,
            gwLockFirmware,
            gwStopBuzzer
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
            this.gateway3.sendMessage(_id, {[_state]: iob.normalizeStateVal(_state, state.val)}, this._cbSendMqttMessage.bind(this));
        } else if (state != undefined && state.ack == true) {
            //
        }
    }

    /* Adapter 'message' event handler */
    async onMessage(obj) {
        if (typeof obj === 'object' && obj.message) {
            const {from, command, message, callback} = obj;
            
            switch (command) {
                case 'GetGatewayFromCloud': {
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

                    break;
                }
                case 'PingGateway3': {
                    const {localip} = message;
                    let avbl = false;

                    if (localip != undefined) avbl = await MiioHelper.discover(localip);
                    if (callback) this.sendTo(from, command, avbl, callback);

                    break;
                }
                case 'CheckTelnet': {
                    const {localip} = message;
                    let avbl = false;

                    if (localip != undefined) avbl = await Gateway3Helper.checkPort(23, localip);
                    if (callback) this.sendTo(from, command, avbl, callback);

                    break;
                }
            }
        }
    }
    
    /* Adapter 'unload' event handler */
    onUnload(callback) {
        try {
            this.setState('info.connection', false, true);

            for (let t of Object.values(this.timers))
                clearTimeout(t);
            this.#timers = undefined;

            callback();
        } catch (e) {
            if (e)
                this.logger.error(`Unload error (${e.stack})`);

            this.sendError(e, `Unload error`);
            callback();
        }
    }

    /* MQTT on 'connect' event callback */
    async _onMqttConnect() {
        this.#mqttc.subscribe('#');
    }

    /* MQTT on 'message' event callback */
    async _onMqttMessage(topic, msg) {
        this.logger.debug(`(_MQTT_) ${topic} ${msg}`);
        
        /* */
        if (topic.match(/^zigbee\/send$/gm)) {
            this.gateway3.processMessageZigbee(JSON.parse(msg), this._cbProcessMessageZigbee.bind(this));
        }  else if (topic.match(/^log\/ble$/gm)) {
            this.gateway3.processMessageBle(JSON.parse(msg), this._cbProcessMessageBle.bind(this));
        }  else if (topic.match(/^log\/miio$/gm)) {
            // TODO: or not TODO:
        } else if (topic.match(/\/heartbeat$/gm)) {
            //TODO: or not TODO:
            // Gateway heartbeats (don't handle for now)
        } else if (topic.match(/\/(MessageReceived|devicestatechange)$/gm)) {
            // TODO: or not TODO:
        }
    }

    /* */
    async _cbProcessMessageZigbee(mac, payload) {
        const id = String(mac).substr(2);
        const states = await this.getStatesAsync(`${id}*`);

        const context = Object.assign({},
            Object.keys(states).reduce((p, c) => {
                const [sn,] = c.split('.').splice(-1);

                return Object.assign({}, p, {[sn]: (states[c] || {})['val']});
            }, {}),
            Object.keys(payload).reduce((p, c) => {
                const val = payload[c];

                return Object.assign({}, p, val != undefined ? {[c]:  iob.normalizeStateVal(c, val)} : {});
            }, {})
        );

        /* create array of states setters functions */
        const funcs = Object.keys(payload).map(k => {
            const val = context[k];
            const setter = iob.getSetter(k);

            if (setter != undefined) {
                return async () => {
                    setter(
                        id,
                        async val => {await this.setStateAsync(`${id}.${k}`, val, true)},
                        context,
                        this.#timers
                    );
                };
            } else if (val != undefined) {
                return async () => {await this.setStateAsync(`${id}.${k}`, val, true)};
            }
        });

        /* call states setters */
        for (let sf of funcs)
            if (typeof sf === 'function') sf();
    }

    /* */
    async _cbProcessMessageBle(mac, payload) {
        const id = String(mac).substr(2);

        /**
         * Have to try create Object here because I don't know specs for all bluetooth devices 
         * and can't create needed objects in _cbFindOrCreateDevice
         * TODO: FIXME:
         */
        for (let spec of Object.keys(payload)) {
            await this.setObjectNotExistsAsync(`${id}.${spec}`, iob.normalizeObject({
                '_id': `${this.namespace}.${id}.${spec}`,
                'type': 'state',
                'native': {},
                'common': {}
            }));

            const val = payload[spec];
            
            if (val != undefined)
                await this.setStateAsync(`${id}.${spec}`, iob.normalizeStateVal(spec, val), true);
        }
    }

    /*
        Callback function which called by gateway initialization.
        It take device and create objects and states if needed.
    */
    async _cbFindOrCreateDevice(_device) {
        if (_device == undefined) return;

        const {mac, model, specs, init} = _device;
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

        /* */
        for (let spec of specs) {
            /* create state object if it not exist */
            await this.setObjectNotExistsAsync(`${objectId}.${spec}`, iob.normalizeObject({
                '_id': `${this.namespace}.${objectId}.${spec}`,
                'type': 'state',
                'native': {},
                'common': {}
            }));
            
            /* set init state value if it exist */
            const val = init[spec];
            
            if (val != undefined)
                await this.setStateAsync(`${objectId}.${spec}`, iob.normalizeStateVal(spec, val), true);
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