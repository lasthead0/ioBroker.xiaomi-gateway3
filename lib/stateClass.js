'use strict';

const {isObject, isArray} = require('./tools');

/**
 * States classes mechanism provide possibility to operate ioBroker states which mapped with device properties. 
 * State class allow to configure state name, properties, functions to set and get value, dependencies between state and etc.
 * Each device is described by this classes (what define device specification).
 * 
 * Base `StateClass` not used as state class. It has to be extended by another class.
 * `StateClass` has several functions which can be used as default functions or been overridden by child state class.
 * 
 * class StateClass {
 *     var stateName
 *         variable holds state name.
 * 
 * 
 *     var stateCommon
 *         variable holds object with state common definition.
 * 
 * 
 *     var valueMap
 *         variable (arrays of two arrays) holds mapping values (like [[1, 0], [true, false]]).
 * 
 * 
 *     var dependsOn
 *         variable (array) holds state names on which depends this state.
 *     
 * 
 *     function _update(stateName, stateCommon, options)
 *         special function which is used to initialize state class properties (used in constructor, have not to be overriden).
 * 
 *         parameters:
 *             stateName    String  - Name of ioBroker state
 *             stateCommon  Object  - Changes to state defaults
 *             options      Object  - Options to configure state class ({valueMap: [any[], any[]] dependsOn: string[]})
 * 
 * 
 *     function setter(dev, callback, context, timers) {
 *         function accepts several parameters and used to set state value.
 *         
 *         parameters:
 *             dev       String    - device object id
 *             callback  Function  - function which set state value
 *             context   Object    - key-array object {state1Name: [oldValue /valueFromState/, newValue /valueFromPayload/], state2Name: [..., ...], ...}
 *                 `newValue` is used generally to set state new value
 *                 `oldValue` is used by special states which exists only in ioBroker but not in payload (like `occupancy_timeout`)
 *             timers    Object    - key-value object of timers for setTimeout purpose (is setter use setTimeout or setInterval)
 * 
 * 
 *     function normalizeLeft(val)
 *         function returns state acceptable value.
 * 
 * 
 *     function normalizeRight(val)
 *         function returns value for gateway.
 * 
 * 
 *     get stateObject()
 *         function (getter) returns normalized object definition whish will be used to create state object in ioBroker.
 * }
 * 
 * Each state class has to extends `StateClass` (but not other state class) and must have own name (defined in `stateName`).
 * State class should to define other properties but this is optional.
 * 
 * Alse, each child class must have constructor (exactly like below)
 * constructor(...args) {
 *     super();
 *     this._update(...args);
 * }
 * 
 */

/* */
class StateClass {
    stateName = undefined;
    stateCommon = {/* name, role, type, read, write, unit, min, max, states */};
    valueMap = [/* [...outer values] */undefined, /* ...[iob state values] */undefined];
    dependsOn = [];

    /**
     * 
     * @param {String=} stateName - Name of ioBroker state
     * @param {Object=} stateCommon - Changes to state defaults
     * @param {{
     *         valueMap: [any[], any[]]
     *         dependsOn: string[]
     *     }=} options - Options to configure state class
     */
    _update = (stateName, stateCommon, options) => {
        const isCommonLike = obj => {
            const props = ['name', 'role', 'type', 'read', 'write', 'unit', 'min', 'max', 'states'];
            
            if (obj != undefined)
                return Object.getOwnPropertyNames(obj).reduce((p, c) => p || props.includes(c), false);
            else
                return false;
        };

        //case (stateName, options, )
        if (isObject(stateCommon) && !isCommonLike(stateCommon))
            options = stateCommon;
        
        if (isObject(stateName) && isCommonLike(stateName))
            // case (stateCommon, , )
            stateCommon = stateName;
        else if (isObject(stateName) && !isCommonLike(stateName) && stateCommon == undefined)
            // case (options, , )
            options = stateName;
        else if (stateName != undefined && typeof stateName == 'string')
            this.stateName = stateName;

        if (isObject(stateCommon) && isCommonLike(stateCommon))
            this.stateCommon = Object.assign({}, this.stateCommon, stateCommon);

        if (isObject(options) && Object.getOwnPropertyNames(options).includes('dependsOn'))
            this.dependsOn = options['dependsOn'];
        
        if (isObject(options) && Object.getOwnPropertyNames(options).includes('valueMap'))
            this.valueMap = options['valueMap'];
    };

    /**
     * 
     * @param {*} _ 
     * @param {Function} cb Callback function
     * @param {Object} context All device states
     */
    setter(_, cb, context) {
        if (context[this.stateName] != undefined) {
            const [, val] = context[this.stateName] || [];
            
            cb(val);
        }
    }

    /**
     * Convert given value to value available in state 
     * 
     * @param {*} val - some value
     * @returns normalized value
     */
    normalizeLeft(val) {
        const [from, to] = this.valueMap;

        if (from == undefined || to == undefined)
            return val;

        return to[from.indexOf(val)];
    }

    /**
     * Convert state value into some mapped value
     * 
     * @param {*} val state value
     * @returns some mapped value
     */
    normalizeRight(val) {
        const [to, from] = this.valueMap;
        
        if (from == undefined || to == undefined)
            return val;

        return to[from.indexOf(val)];
    }

    /**
     * @returns Normalized ioBroker state object
     */
    get stateObject() {
        /* */
        const {name, role = 'state', type, read, write, unit, min, max, states} = this.stateCommon;

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
        return {
            'type': 'state',
            'native': {},
            'common': {
                name,
                role,
                type: type != undefined ? type : defineCommonType(role),
                read: read != undefined ? read : defineCommonRead(role),
                write: write != undefined ? write : defineCommonWrite(role),
                unit,
                min,
                max,
                states
            }
        };
    }
}

/* */
module.exports = {
    Alarm: class extends StateClass {
        stateName = 'alarm';
        stateCommon = {
            name: 'Alarm',
            role: 'sensor.alarm'
        };
        valueMap = [[0, 1], [false, true]];

        /* */
        constructor(...args) {
            super();
            this._update(...args);
        }
    },
    Available: class extends StateClass {
        stateName = 'available';
        stateCommon = {
            name: 'Available',
            role: 'state',
            type: 'boolean',
            read: true,
            write: false,
        };
        valueMap = [[0, 1], [false, true]];

        /* Constructor is removed to prevent state definition changes */
    },
    Battery: class extends StateClass {
        stateName = 'battery';
        stateCommon = {
            name: 'Battery percent',
            role: 'value.battery',
            unit: '%',
            min: 0,
            max: 100
        };

        /* */
        constructor(...args) {
            super();
            this._update(...args);
        }
    },
    Brightness: class extends StateClass {
        stateName = 'brightness';
        stateCommon = {
            name: 'Light brightness',
            role: 'value.brightness',
            unit: 'lux' 
        };

        /* */
        constructor(...args) {
            super();
            this._update(...args);
        }
    },
    Channel: class extends StateClass {
        stateName = 'channel_1';
        stateCommon = {
            name: 'Chanel 1 switch',
            role: 'switch'
        };

        /* */
        constructor(...args) {
            super();
            this._update(...args);
        }
    },
    ColorTemperature: class extends StateClass {
        stateName = 'color_temperature';
        stateCommon = {
            name: 'Color temperature',
            role: 'level.color.temperature',
            unit: 'K',
            min: 2200,
            max: 6500
        };

        /* */
        constructor(...args) {
            super();
            this._update(...args);
        }
    },
    Conductivity: class extends StateClass { // BLE eid == 0x1009
        stateName = 'conductivity';
        stateCommon = {
            name: 'Soil EC',
            role: 'value',
            unit: 'us/cm',
            min: 0,
            max: 5000
        };

        /* */
        constructor(...args) {
            super();
            this._update(...args);
        }
    },
    Contact: class extends StateClass {
        stateName = 'contact';
        stateCommon = {
            name: 'Contact',
            role: 'sensor.door'
        };
        valueMap = [[0, 1], [true, false]];

        /* */
        constructor(...args) {
            super();
            this._update(...args);
        }
    },
    CurtainLevel: class extends StateClass {
        stateName = 'curtain_level';
        stateCommon = {
            name: 'Curtain level',
            role: 'level.curtain',
            unit: '%',
            min: 0,
            max: 100
        };

        /* */
        constructor(...args) {
            super();
            this._update(...args);
        }
    },
    CurtainMotor: class extends StateClass {
        stateName = 'motor_action';
        stateCommon = {
            name: 'Motor action',
            role: 'state',
            type: 'number',
            states: {0: 'close', 1: 'open', 2: 'stop'}
        };

        /* */
        constructor(...args) {
            super();
            this._update(...args);
        }
    },
    Formaldehyde: class extends StateClass { // BLE eid == 0x1010
        stateName = 'formaldehyde';
        stateCommon = {
            name: 'Formaldehyde concentration',
            role: 'value',
            unit: 'mg/m3'
        };

        /* */
        constructor(...args) {
            super();
            this._update(...args);
        }
    },
    Humidity: class extends StateClass {
        stateName = 'humidity';
        stateCommon = {
            name: 'Humidity',
            role: 'value.humidity',
            unit: '%',
            min: 0,
            max: 100
        };

        /* */
        constructor(...args) {
            super();
            this._update(...args);
        }
    },
    IdleTime: class extends StateClass { // BLE eid == 0x1017
        stateName = 'idle_time';
        stateCommon = {
            name: 'Duration',
            role: 'value',
            unit: 'seconds'
        };

        /* */
        constructor(...args) {
            super();
            this._update(...args);
        }
    },
    Illuminance: class extends StateClass {
        stateName = 'illuminance';
        stateCommon = {
            name: 'Illuminance',
            role: 'value.brightness',
            unit: 'lux'
        };

        /* */
        constructor(...args) {
            super();
            this._update(...args);
        }
    },
    Light: class extends StateClass { // BLE eid == 0x1007, 0x1018, 0x0F
        stateName = 'light';
        stateCommon = {
            name: 'Light',
            role: 'sensor.light'
        };
        valueMap = [[0, 1], [false, true]];

        /* */
        constructor(...args) {
            super();
            this._update(...args);
        }
    },
    LinkQuality: class extends StateClass { //rssi
        stateName = 'link_quality';
        stateCommon = {
            name: 'Link quality',
            role: 'level',
            write: false,
            min: 0,
            max: 255
        };

        /* */
        constructor(...args) {
            super();
            this._update(...args);
        }
    },
    LoadPower: class extends StateClass {
        stateName = 'load_power';
        stateCommon = {
            name: 'Load power',
            role: 'value.power',
            unit: 'W'
        };

        /* */
        constructor(...args) {
            super();
            this._update(...args);
        }
    },
    LoadVoltage: class extends StateClass {
        stateName = 'load_voltage';
        stateCommon = {
            name: 'Load voltage',
            role: 'value.voltage',
            unit: 'V'
        };

        /* */
        constructor(...args) {
            super();
            this._update(...args);
        }
    },
    LockState: class extends StateClass {
        stateName = 'lock_state';
        stateCommon = {
            name: 'Lock state',
            role: 'sensor.lock'
        };

        /* */
        constructor(...args) {
            super();
            this._update(...args);
        }
    },
    Moisture: class extends StateClass { // BLE eid == 0x1008
        stateName = 'moisture';
        stateCommon = {
            name: 'Humidity percentage',
            role: 'value',
            unit: '%',
            min: 0,
            max: 100
        };

        /* */
        constructor(...args) {
            super();
            this._update(...args);
        }
    },
    NoMotion: class extends StateClass {
        stateName = 'no_motion';
        stateCommon = {
            name: 'Time from last motion',
            role: 'state',
            read: true,
            write: false,
            type: 'number',
            unit: 'seconds'
        };
        dependsOn = ['occupancy', 'occupancy_timeout'];

        /* */
        constructor(...args) {
            super();
            this._update(...args);
        }

        /* */
        setter(dev, cb, context, timers) {
            const [, val] = context[this.dependsOn[0]] || [];
            const [ot] = context[this.dependsOn[1]] || [];

            const t = `${dev}.${this.stateName}`;

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
    Occupancy: class extends StateClass {
        stateName = 'occupancy';
        stateCommon = {
            name: 'Occupancy',
            role: 'sensor.motion'
        };
        valueMap = [[0, 1], [false, true]];
        dependsOn = ['occupancy', 'occupancy_timeout'];

        /* */
        constructor(...args) {
            super();
            this._update(...args);
        }

        /* */
        setter(dev, cb, context, timers) {
            const [, val] = context[this.dependsOn[0]] || [];
            const [ot] = context[this.dependsOn[1]] || [];

            const t = `${dev}.${this.stateName}`;

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
        };
    },
    OccupancyTimeout: class extends StateClass {
        stateName = 'occupancy_timeout';
        stateCommon = {
            name: 'Occupancy timeout',
            role: 'state',
            type: 'number',
            unit: 'seconds'
        };

        /* */
        constructor(...args) {
            super();
            this._update(...args);
        }
    },
    Power: class extends StateClass { // BLE eid == 0x1005 (same as switch)
        stateName = 'power';
        stateCommon = {
            name: 'Power state',
            role: 'switch'
        };
        valueMap = [[0, 1], [false, true]];

        /* */
        constructor(...args) {
            super();
            this._update(...args);
        }
    },
    Pressure: class extends StateClass {
        stateName = 'pressure';
        stateCommon = {
            name: 'Pressure',
            role: 'value.pressure',
            unit: 'hPa',
            min: 0,
            max: 10000
        };

        /* */
        constructor(...args) {
            super();
            this._update(...args);
        }
    },
    Remaining: class extends StateClass { // BLE eid == 0x1013
        stateName = 'remaining';
        stateCommon = {
            name: 'Remaining percentage',
            role: 'value',
            unit: '%',
            min: 0,
            max: 100
        };

        /* */
        constructor(...args) {
            super();
            this._update(...args);
        }
    },
    RunState: class extends StateClass {
        stateName = 'run_state';
        stateCommon = {
            name: 'Run state',
            role: 'state',
            write: false,
            type: 'string'
        };
        valueMap = [[0, 1, 2], ['closing', 'opening', 'stop']];

        /* */
        constructor(...args) {
            super();
            this._update(...args);
        }
    },
    Switch: class extends StateClass {
        stateName = 'switch';
        stateCommon = {
            name: 'Switch state',
            role: 'switch'
        };
        valueMap = [[0, 1], [false, true]];

        /* */
        constructor(...args) {
            super();
            this._update(...args);
        }
    },
    Temperature: class extends StateClass {
        stateName = 'temperature';
        stateCommon = {
            name: 'Temperature',
            role: 'value.temperature',
            unit: '°C'
        };

        /* */
        constructor(...args) {
            super();
            this._update(...args);
        }
    },
    Voltage: class extends StateClass {
        stateName = 'voltage';
        stateCommon = {
            name: 'Battery voltage',
            role: 'value.voltage',
            unit: 'V'
        };

        /* */
        constructor(...args) {
            super();
            this._update(...args);
        }
    },

    /* Optional common state classes */
    DebugOutput: class extends StateClass {
        stateName = 'debug_output';
        stateCommon = {
            role: 'state',
            name: 'Debug output',
            type: 'string',
            read: true,
            write: false
        };
        dependsOn = ['debug_output'];

        /* Constructor is removed to prevent state definition changes */

        /* */
        setter(dev, cb, context) {
            const [oldVal, newVal] = context[this.dependsOn[0]] || [];

            const debugOutputOldVal = JSON.parse(oldVal || '{}');
            const debugOutputNewVal = JSON.parse(newVal || '{}');

            const debugOutputPayloadVal = Object.assign({}, debugOutputNewVal, debugOutputOldVal);

            Object.keys(debugOutputNewVal)
                .filter(key => isArray(debugOutputPayloadVal[key] || []) && isArray(debugOutputNewVal[key]))
                .forEach(key => {
                    debugOutputPayloadVal[key] = [...new Set((debugOutputPayloadVal[key] || []).concat(debugOutputNewVal[key] || []))]
                        .sort((a, b) => String(a).localeCompare(String(b), 'en-US-u-kn-true'));
                });

            cb(JSON.stringify(debugOutputPayloadVal));
        }
    },
    MessagesStat: class extends StateClass {
        stateName = 'messages_stat';
        stateCommon = {
            role: 'state',
            name: 'Messages statistic',
            type: 'string',
            read: true,
            write: false
        };

        /* Constructor is removed to prevent state definition changes */
    },
};
