'use strict';

const net = require('net');
/* */
const miioProtocol = require('js-miio-simple');

/* Utils for miIO protocol */
class MiioHelper {
    /* Check is device available (with miIO) */
    static async discover(ip) {
        if (ip != undefined && ip != '') {
            const miIO = new miioProtocol(ip);
            const result = await miIO.discover();

            return result[0];
        } else {
            return false;
        }
    }
}

/* Helper class for Gateway3 */
class Gateway3Helper {
    /* Check if port opened */
    static async checkPort(port, ip) {
        try {
            return new Promise((resolve, reject) => {
                const socket = net.Socket();

                socket.setTimeout(1000);

                const onError = () => {
                    socket.destroy();
                    reject(false);
                };

                socket.connect(port, ip, () => {
                    socket.end();
                    resolve(true);
                })
                    .once('error', onError)
                    .once('timeout', onError)
                ;
            })
                .then(msg => msg)
                .catch(error => error)
            ;
        } catch (error) {
            return false;
        }
    }
}

/* */
class ioBrokerHelper {
    /* {
        name,
        role,
        type,
        read,
        write,
        unit,
        min,
        max
    } */
    static common = {
        alarm: {
            name: 'Alarm',
            role: 'sensor.alarm'
        },
        available: {
            name: 'Available',
            role: 'state',
            type: 'boolean',
            read: true,
            write: false,
            /* */
            normalize: val => {
                if (typeof val == 'number') return val == 0 ? false : true;
                if (typeof val == 'boolean') return val == false ? 0 : 1;
            }
        },
        battery: {
            name: 'Battery percent',
            role: 'value.battery',
            unit: '%',
            min: 0,
            max: 100
        },
        brightness: {
            name: 'Light brightness',
            role: 'value.brightness',
            unit: 'lux' 
        },
        channel_1: {
            name: 'Chanel 1 switch',
            role: 'switch'
        },
        channel_2: {
            name: 'Chanel 2 switch',
            role: 'switch'
        },
        channel_3: {
            name: 'Chanel 3 switch',
            role: 'switch'
        },
        color_temperature: {
            name: 'Color temperature',
            role: 'level.color.temperature',
            unit: 'K',
            min: 2200,
            max: 6500
        },
        conductivity: { // BLE eid == 0x1009
            name: 'Soil EC',
            role: 'value',
            unit: 'us/cm',
            min: 0,
            max: 5000
        },
        contact: {
            name: 'Contact',
            role: 'sensor.door',
            /* */
            normalize: val => {
                if (typeof val == 'number') return val == 0 ? true : false;
                if (typeof val == 'boolean') return val == true ? 0 : 1;
            }
        },
        firmware_lock: {
            name: 'Firmware lock',
            role: 'switch'
        },
        formaldehyde: { // BLE eid == 0x1010
            name: 'Formaldehyde concentration',
            role: 'value',
            unit: 'mg/m3'
        },
        gas: { // zigbee, BLE eid == 0x1016
            name: 'Gas detected',
            role: 'sensor.alarm',
            /* */
            normalize: val => {
                if (typeof val == 'number') return val == 0 ? false : true;
                if (typeof val == 'boolean') return val == false ? 0 : 1;
            }
        },
        humidity: {
            name: 'Humidity',
            role: 'value.humidity',
            unit: '%',
            min: 0,
            max: 100
        },
        idle_time: { // BLE eid == 0x1017
            name: 'Duration',
            role: 'value',
            unit: 'seconds'
        },
        illuminance: {
            name: 'Illuminance',
            role: 'value.brightness',
            unit: 'lux'
        },
        light: { // BLE eid == 0x1007, 0x1018, 0x0F
            name: 'Light',
            role: 'sensor.light',
            /* */
            normalize: val => {
                if (typeof val == 'number') return val == 0 ? false : true;
                if (typeof val == 'boolean') return val == false ? 0 : 1;
            }
        },
        link_quality: { //rssi
            name: 'Link quality',
            role: 'level',
            write: false,
            min: 0,
            max: 255
        },
        load_power: {
            name: 'Load power',
            role: 'value.power',
            unit: 'W',
        },
        load_voltage: {
            name: 'Load voltage',
            role: 'value.voltage',
            unit: 'V'
        },
        lock_state: {
            name: 'Lock state',
            role: 'sensor.lock'
        },
        moisture: { // BLE eid == 0x1008
            name: 'Humidity percentage',
            role: 'value',
            unit: '%',
            min: 0,
            max: 100
        },
        no_motion: {
            name: 'Time from last motion',
            role: 'state',
            read: true,
            write: false,
            type: 'number',
            unit: 'seconds',
            /* */
            setter: (dev, cb, {occupancy: val, occupancy_timeout: ot}, timers) => {
                const t = `${dev}.no_motion`;

                if (val) {
                    if (timers[t]) {
                        clearInterval(timers[t]);
                        delete timers[t];
                    }

                    if (!timers[t]) {
                        const timeout = (ot != undefined && ot != 0) ? ot : 60;
                        let counter = timeout;

                        timers[t] = setInterval(() => {
                            cb(counter);
                            if (counter > 1800) {
                                clearInterval(timers[t]);
                                delete timers[t];
                            }
                            counter += timeout;
                        }, timeout*1000);
                    }

                    cb(0);
                }
            }
        },
        occupancy: {
            name: 'Occupancy',
            role: 'sensor.motion',
            /* */
            setter: (dev, cb, {occupancy: val, occupancy_timeout: ot}, timers) => {
                const t = `${dev}.occupancy`;

                if (val) {
                    if (timers[t]) {
                        clearTimeout(timers[t]);
                        delete timers[t];
                    }

                    if (!timers[t]) {
                        const timeout = (ot != undefined && ot != 0) ? ot : 60;

                        timers[t] = setTimeout(() => {
                            cb(false);
                        }, timeout*1000);
                    }
                }
                cb(val);
            },
            normalize: val => {
                if (typeof val == 'number') return val == 0 ? false : true;
                if (typeof val == 'boolean') return val == false ? 0 : 1;
            }
        },
        occupancy_timeout: {
            name: 'Occupancy timeout',
            role: 'state',
            type: 'number',
            unit: 'seconds'
        },
        power: { // BLE eid == 0x1005 (same as switch)
            name: 'Power state',
            role: 'switch',
            /* */
            normalize: val => {
                if (typeof val == 'number') return val == 0 ? false : true;
                if (typeof val == 'boolean') return val == false ? 0 : 1;
            }
        },
        pressure: {
            name: 'Pressure',
            role: 'value.pressure',
            unit: 'hPa',
            min: 0,
            max: 10000
        },
        remaining: { // BLE eid == 0x1013
            name: 'Remaining percentage',
            role: 'value',
            unit: '%',
            min: 0,
            max: 100
        },
        smoke: { // zigbee, BLE eid == 0x1015
            name: 'Smoke detected',
            role: 'sensor.alarm',
            /* */
            normalize: val => {
                if (typeof val == 'number') return val == 0 ? false : true;
                if (typeof val == 'boolean') return val == false ? 0 : 1;
            }
        },
        switch: {
            name: 'Switch state',
            role: 'switch',
            /* */
            normalize: val => {
                if (typeof val == 'number') return val == 0 ? false : true;
                if (typeof val == 'boolean') return val == false ? 0 : 1;
            }
        },
        temperature: {
            name: 'Temperature',
            role: 'value.temperature',
            unit: '°C'
        },
        voltage: {
            name: 'Battery voltage',
            role: 'value.voltage',
            unit: 'V'
        },
        water_leak: { // zigbee, BLE eid == 0x1014
            name: 'Water leak detected',
            role: 'sensor.alarm',
            /* */
            normalize: val => {
                if (typeof val == 'number') return val == 0 ? false : true;
                if (typeof val == 'boolean') return val == false ? 0 : 1;
            }
        },
    }

    /* Function to normalize object common properties on creation */
    static normalizeStateObject(state, diff) {
        if (state == undefined) return {};

        /* */
        const stateObject = {'common': {}};
        const {name, role, type, read, write, unit, min, max} = this.common[state] || {};

        /* */
        if (role == undefined) return stateObject;

        /* normalize type by role */
        const defineCommonType = role => {
            if (RegExp(/^(sensor|indicator|button|switch)(.?[\d\w]*)*/g).test(role))
                return 'boolean';
            else if (RegExp(/^(value|level)(.?[\d\w]*)*/g).test(role))
                return 'number';
            else
                return 'string';
        };
        const defineCommonRead = role => RegExp(/^(state|sensor|indicator|value|level|switch)(\.[\w]*)*$/g).test(role);
        const defineCommonWrite = role => RegExp(/^(state|button|level|switch)(\.[\w]*)*$/g).test(role);

        /* combine 'common' parts */
        stateObject.common = Object.assign({}, stateObject.common,
            {
                name,
                role,
                type: type != undefined ? type : defineCommonType(role),
                read: read != undefined ? read : defineCommonRead(role),
                write: write != undefined ? write : defineCommonWrite(role),
                unit,
                min,
                max
            },
            diff || {}
        );

        return stateObject;
    }

    static normalizeStateVal(state, val) {
        const {normalize} = this.common[state];

        return (typeof normalize == 'function') ? normalize(val) : val;
    }

    static stateSetter(state) {
        const c = this.common[state];
        
        if (c != undefined && typeof c.setter === 'function') {
            return c.setter;
        } else {
            return (_, cb, context) => {
                if (context[state] != undefined)
                    return cb(context[state]);
                else
                    return () => void 0;
            };
        }
    }
}

module.exports = {MiioHelper, Gateway3Helper, ioBrokerHelper};