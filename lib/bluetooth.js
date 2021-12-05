'use strict';

const {isArray} = require('./tools');

const {
    Alarm,
    Available,
    Battery,
    Brightness,
    Channel,
    ColorTemperature,
    Conductivity,
    Contact,
    Formaldehyde,
    Humidity,
    IdleTime,
    Illuminance,
    Light,
    LinkQuality,
    LoadPower,
    LoadVoltage,
    LockState,
    Moisture,
    NoMotion,
    Occupancy,
    OccupancyTimeout,
    Power,
    Pressure,
    Remaining,
    Switch,
    Temperature,
    Voltage,
    /* */
    DebugOutput
} = require('./stateClass');

/**
 * Each device has a specification:
 * {
 *     '<model>': ['<brand>', '<name>', '<market model>'],
 *     'spec': [
 *         [<resouce>, <property>, <state class>, <state class properties>, <value parsers>],
 *         ...
 *     ]
 * }
 * 
 * - model - `lumi.xxx` for Zigbee devices, number (pdid) for BLE and Mesh devices
 * - spec - array of specs definitions (each spec definition is array too)
 * 
 * spec:
 * [
 *     <resouce> - (String or undefined) Resource name in Lumi spec ('8.0.2012') or MIoT spec ('2.1').
 *     <property> - (String or undefined) Device property name.
 *     <state class> - (Class definition) State class which provide interaction with ioBroker state.
 *     <state class properties> - (Array) Some properties to configure state class.
 *     <value parsers> - (Array) Parsing value functions. 
 * ]
 * 
 * <state class properties>:
 * [
 *     'state_name',
 *     {name, role, type, read, write, unit, min, max},
 *     {valueMap, dependsOn}
 * ]
 */

/* */
module.exports = class Bluetooth {
    
    static #DEVICES = [
        {
            // MiBeacon from official support
            '152': ['Xiaomi', 'Flower Care', 'HHCCJCY01'],
            '349': ['Xiaomi', 'Flower Pot', 'HHCCPOT002'],
            '426': ['Xiaomi', 'TH Sensor', 'LYWSDCGQ/01ZM'],
            '794': ['Xiaomi', 'Door Lock', 'MJZNMS02LM'],
            '839': ['Xiaomi', 'Qingping TH Sensor', 'CGG1'],
            '903': ['Xiaomi', 'ZenMeasure TH', 'MHO-C401'],
            '982': ['Xiaomi', 'Qingping Door Sensor', 'CGH1'],
            '1034': ['Xiaomi', 'Mosquito Repellent', 'WX08ZM'],
            '1115': ['Xiaomi', 'TH Clock', 'LYWSD02MMC'],
            '1161': ['Xiaomi', 'Toothbrush T500', 'MES601'],
            '1249': ['Xiaomi', 'Magic Cube', 'XMMF01JQD'],
            // '1371': ['Xiaomi', 'TH Sensor 2', 'LYWSD03MMC'],
            '1398': ['Xiaomi', 'Alarm Clock', 'CGD1'],
            '1433': ['Xiaomi', 'Door Lock', 'MJZNMS03LM'],
            '1647': ['Xiaomi', 'Qingping TH Lite', 'CGDK2'],
            '1694': ['Aqara', 'Door Lock N100', 'ZNMS16LM'],
            '1695': ['Aqara', 'Door Lock N200', 'ZNMS17LM'],
            '1747': ['Xiaomi', 'ZenMeasure Clock', 'MHO-C303'],
            '1983': ['Yeelight', 'Button S1', 'YLAI003'],
            '2038': ['Xiaomi', 'Night Light 2', 'MJYD02YL-A'],  // 15,4103,4106,4119,4120
            '2147': ['Xiaomi', 'Water Leak Sensor', 'SJWS01LM'],
            '2443': ['Xiaomi', 'Door Sensor 2', 'MCCGQ02HL'],
            '2444': ['Xiaomi', 'Door Lock', 'XMZNMST02YD'],
            '2455': ['Honeywell', 'Smoke Alarm', 'JTYJGD03MI'],
            '2480': ['Xiaomi', 'Safe Box', 'BGX-5/X1-3001'],
            '2691': ['Xiaomi', 'Qingping Motion Sensor', 'CGPR1'],
            // logs: https://github.com/AlexxIT/XiaomiGateway3/issues/180
            // '2701': ['Xiaomi', 'Motion Sensor 2', 'RTCGQ02LM'],  // 15,4119,4120
            '2888': ['Xiaomi', 'Qingping TH Sensor', 'CGG1'],  //same model as 839?!
        },
        {
            '1371': ['Xiaomi', 'TH Sensor 2', 'LYWSD03MMC'],
            'spec': [
                [0x100A, undefined, Battery, [], [p0x100ABattery]],         //4106
                [0x1004, undefined, Temperature, [], [p0x1004Temperature]], //4100
                [0x1006, undefined, Humidity, [], [p0x1006Humidity]],       //4102
            ]
        },
        {
            '2701': ['Xiaomi', 'Motion Sensor 2', 'RTCGQ02LM'], // 15,4106,4119,4120
            'spec': [
                [0x100A, undefined, Battery, [], [p0x100ABattery]],     //4106
                [0x1017, undefined, IdleTime, [], [p0x1017IdleTime]],   //4119
                [0x1018, undefined, Light, [], [p0x1018Light]],         //4120
                [0x0F, undefined, Occupancy, [], [p0x0FOccupancy]],     //15
                [0x0F, undefined, Light, [], [p0x0FIlluminanceOrLight]], //15
                [undefined, undefined, NoMotion, []], // number, seconds
                [undefined, undefined, OccupancyTimeout, []], // number, seconds
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]], //TODO: DebugOutput
            ]
        }
        /* TODO: Mesh
        {
            // Mesh Light
            0: ['Xiaomi', 'Mesh Group', 'Mesh Group'],
            948: ['Yeelight', 'Mesh Downlight', 'YLSD01YL'],
            995: ['Yeelight', 'Mesh Bulb E14', 'YLDP09YL'],
            996: ['Yeelight', 'Mesh Bulb E27', 'YLDP10YL'],
            997: ['Yeelight', 'Mesh Spotlight', 'YLSD04YL'],
            1771: ['Xiaomi', 'Mesh Bulb', 'MJDP09YL'],
            1772: ['Xiaomi', 'Mesh Downlight', 'MJTS01YL/MJTS003'],
            2076: ['Yeelight', 'Mesh Downlight M2', 'YLTS02YL/YLTS04YL'],
            2293: ['Unknown', 'Mesh Lightstrip (RF ready)', 'crzm.light.wy0a01'],
            2342: ['Yeelight', 'Mesh Bulb M2', 'YLDP25YL/YLDP26YL'],
            2351: ['Unknown', 'Mesh Downlight', 'lemesh.light.wy0c05'],
            2584: ['XinGuang', 'XinGuang Smart Light', 'LIBMDA09X'],
            3164: ['Unknown', 'Mesh Downlight (RF ready)', 'lemesh.light.wy0c07'],
            3416: ['Unknown', 'Mesh Downlight', '090615.light.mlig01'],
            3531: ['Unknown', 'ightctl Light', 'lemesh.light.wy0c08'],
            'spec': [
                ['2.1', undefined, 'light'],
                ['2.2', undefined, 'brightness'],
                ['2.3', undefined, 'color_temp'],
            ]
        },
        {
            // Mesh Switches
            1946: ['Xiaomi', 'Mesh Double Wall Switch', 'DHKG02ZM'],
            'spec': [
                ['2.1', undefined, 'left_switch'],
                ['3.1', undefined, 'right_switch'],
            ]
        },
        {
            1945: ['Xiaomi', 'Mesh Wall Switch', 'DHKG01ZM'],
            2007: ['Unknown', 'Mesh Switch Controller', 'lemesh.switch.sw0a01'],
            3150: ['XinGuang', 'Mesh Switch', 'wainft.switch.sw0a01'],
            'spec': [
                ['2.1', undefined, 'switch']
            ],
        },
        {
            2093: ['PTX', 'Mesh Triple Wall Switch', 'PTX-TK3/M'],
            3878: ['PTX', 'Mesh Triple Wall Switch', 'PTX-SK3M'],
            'spec': [
                ['2.1', undefined, 'left_switch'],
                ['3.1', undefined, 'middle_switch'],
                ['4.1', undefined, 'right_switch'],
                ['8.1', undefined, 'backlight'],
                ['8.2', undefined, 'left_smart'],
                ['8.3', undefined, 'middle_smart'],
                ['8.4', undefined, 'right_smart']
            ]
        },
        {
            2257: ['PTX', 'Mesh Double Wall Switch', 'PTX-SK2M'],
            'spec': [
                ['2.1', undefined, 'left_switch'],
                ['3.1', undefined, 'right_switch'],
                ['8.1', undefined, 'backlight'],
                ['8.2', undefined, 'left_smart'],
                ['8.3', undefined, 'right_smart'],
            ]
        },
        {
            2258: ['PTX', 'Mesh Single Wall Switch', 'PTX-SK1M'],
            'spec': [
                ['2.1', undefined, 'switch'],
                ['8.1', undefined, 'backlight'],
                ['8.2', undefined, 'smart'],
            ]
        },
        {
            2717: ['Xiaomi', 'Mesh Triple Wall Switch', 'ZNKG03HL/ISA-KG03HL'],
            'spec': [
                ['2.1', undefined, 'left_switch'],
                ['3.1', undefined, 'middle_switch'],
                ['4.1', undefined, 'right_switch'],
                ['6.1', undefined, 'humidity'],
                ['6.7', undefined, 'temperature'],
            ]
        },
        {
            3083: ['Xiaomi', 'Mi Smart Electrical Outlet', 'ZNCZ01ZM'],
            'spec': [
                ['2.1', undefined, 'outlet'],
                ['3.1', undefined, 'power'],
                ['4.1', undefined, 'backlight'],
            ]
        },
        {
            2715: ['Xiaomi', 'Mesh Single Wall Switch', 'ZNKG01HL'],
            'spec': [
                ['2.1', undefined, 'switch'],
                ['6.1', undefined, 'humidity'],
                ['6.7', undefined, 'temperature'],
            ]
        },
        {
            2716: ['Xiaomi', 'Mesh Double Wall Switch', 'ZNKG02HL'],
            'spec': [
                ['2.1', undefined, 'left_switch'],
                ['3.1', undefined, 'right_switch'],
                ['6.1', undefined, 'humidity'],
                ['6.7', undefined, 'temperature'],
            ]
        }
        */
    ];
    /*
    // if color temp not default 2700..6500
    COLOR_TEMP = {
        # https://github.com/AlexxIT/XiaomiGateway3/issues/350
        2351: [3100, 3100],
        2584: [3000, 6400],
        3531: [3000, 6400],
    }

    // if max brightness not default 65535
    MAX_BRIGHTNESS = {
        2293: 100,
        2351: 100,
        2584: 100,
        3164: 100,
        3416: 100,
        3531: 100,
    }

    BLE_FINGERPRINT_ACTION = [
        "Match successful", "Match failed", "Timeout", "Low quality",
        "Insufficient area", "Skin is too dry", "Skin is too wet"
    ]

    BLE_DOOR_ACTION = [
        "Door is open", "Door is closed", "Timeout is not closed",
        "Knock on the door", "Breaking the door", "Door is stuck"
    ]

    BLE_LOCK_ACTION = {
        0b0000: "Unlock outside the door",
        0b0001: "Lock",
        0b0010: "Turn on anti-lock",
        0b0011: "Turn off anti-lock",
        0b0100: "Unlock inside the door",
        0b0101: "Lock inside the door",
        0b0110: "Turn on child lock",
        0b0111: "Turn off child lock",
        0b1111: None
    }

    BLE_LOCK_METHOD = {
        0b0000: "bluetooth",
        0b0001: "password",
        0b0010: "biological",
        0b0011: "key",
        0b0100: "turntable",
        0b0101: "nfc",
        0b0110: "one-time password",
        0b0111: "two-step verification",
        0b1000: "coercion",
        0b1010: "manual",
        0b1011: "automatic",
        0b1111: None
    }
    
    BLE_LOCK_ERROR = {
        0xC0DE0000: "Frequent unlocking with incorrect password",
        0xC0DE0001: "Frequent unlocking with wrong fingerprints",
        0xC0DE0002: "Operation timeout (password input timeout)",
        0xC0DE0003: "Lock picking",
        0xC0DE0004: "Reset button is pressed",
        0xC0DE0005: "The wrong key is frequently unlocked",
        0xC0DE0006: "Foreign body in the keyhole",
        0xC0DE0007: "The key has not been taken out",
        0xC0DE0008: "Error NFC frequently unlocks",
        0xC0DE0009: "Timeout is not locked as required",
        0xC0DE000A: "Failure to unlock frequently in multiple ways",
        0xC0DE000B: "Unlocking the face frequently fails",
        0xC0DE000C: "Failure to unlock the vein frequently",
        0xC0DE000D: "Hijacking alarm",
        0xC0DE000E: "Unlock inside the door after arming",
        0xC0DE000F: "Palmprints frequently fail to unlock",
        0xC0DE0010: "The safe was moved",
        0xC0DE1000: "The battery level is less than 10%",
        0xC0DE1001: "The battery is less than 5%",
        0xC0DE1002: "The fingerprint sensor is abnormal",
        0xC0DE1003: "The accessory battery is low",
        0xC0DE1004: "Mechanical failure",
    }

    ACTIONS = {
        1249: {0: 'right', 1: 'left'},
        1983: {0: 'single', 0x010000: 'double', 0x020000: 'hold'},
        2147: {0: 'single'},
    }
    */

    // https://iot.mi.com/new/doc/embedded-development/ble/object-definition
    //TODO: FIXME: Remove this method someday
    static parseXiaomiBle(msg) {
        const paramStateVal = msg => {
            const {eid, edata, pdid} = msg;
            const length = Uint8Array.from(Buffer.from(edata, 'hex')).byteLength;

            if (eid == 0x1001 && length == 3) { //4097
                return [];
            
            } else if (eid == 0x1002 && length == 1) { // 4098
                return [];

            } else if (eid == 0x1003 && length == 1) { //4099
                return [
                    [pdid, LinkQuality, [], [p0x1003LinkQuality], eid, edata]
                ];

            } else if (eid == 0x1004 && length == 2) { //4100
                return [
                    [pdid, Temperature, [], [p0x1004Temperature], eid, edata]
                ];

            } else if (eid == 0x1005 && length == 2) { //4101
                // Kettle, thanks https://github.com/custom-components/ble_monitor/
                return [
                    [pdid, Power, [], [p0x1005Power], eid, edata],
                    [pdid, Temperature, [], [p0x1005Temperature], eid, edata]
                ];

            } else if (eid == 0x1006 && length == 2) { //4102
                return [
                    [pdid, Humidity, [], [p0x1006Humidity], eid, edata]
                ];

            } else if (eid == 0x1007 && length == 3) { //4103
                if (pdid == 2038) {
                    return [
                        [pdid, Light, [], [p0x1007IlluminanceOrLight], eid, edata]
                    ];
                } else {
                    return [
                        [pdid, Illuminance, [], [p0x1007IlluminanceOrLight], eid, edata]
                    ];
                }

            } else if (eid == 0x1008 && length == 1) { //4104
                return [
                    [pdid, Moisture, [], [p0x1008Moisture], eid, edata]
                ];

            } else if (eid == 0x1009 && length == 2) { //4105
                return [
                    [pdid, Conductivity, [], [p0x1009Conductivity], eid, edata]
                ];

            } else if (eid == 0x100A) {  // 4106
                return [
                    [pdid, Battery, [], [p0x100ABattery], eid, edata]
                ];

            } else if (eid == 0x100D && length == 4) { //4109
                return [
                    [pdid, Temperature, [], [p0x100DTemperature], eid, edata],
                    [pdid, Humidity, [], [p0x100DHumidity], eid, edata]
                ];

            } else if (eid == 0x100E && length == 1) { //4110
                return [];

            } else if (eid == 0x100F && length == 1) { //4111
                return [];

            } else if (eid == 0x1010 && length == 2) { //4112
                return [
                    [pdid, Formaldehyde, [], [p0x1010Formaldehyde], eid, edata]
                ];

            } else if (eid == 0x1012 && length == 1) { //4114
                return [];

            } else if (eid == 0x1013 && length == 1) { //4115
                return [
                    [pdid, Remaining, [], [p0x1013Remaining], eid, edata]
                ];

            } else if (eid == 0x1014 && length == 1) { //4116
                return [
                    [pdid, Alarm, ['water_leak', {name: 'Water leak detected'}], [p0x1014Alarm], eid, edata]
                ]; // 1 => on => alarm

            } else if (eid == 0x1015 && length == 1) { //4117
                return [
                    [pdid, Alarm, ['smoke', {name: 'Smoke detected'}], [p0x1015Alarm], eid, edata]
                ]; // 1 => on => alarm

            } else if (eid == 0x1016 && length == 1) { //4118
                return [
                    [pdid, Alarm, ['gas', {name: 'Gas detected'}], [p0x1016Alarm], eid, edata]
                ]; // 1 => on => alarm

            } else if (eid == 0x1017 && length == 4) { //4119
                return [
                    [pdid, IdleTime, [], [p0x1017IdleTime], eid, edata]
                ];

            } else if (eid == 0x1018 && length == 1) { //4120
                return [
                    [pdid, Light, [], [p0x1018Light], eid, edata]
                ];

            } else if (eid == 0x1019 && length == 1) { //4121
                return [
                    [pdid, Contact, [], [p0x1019Contact], eid, edata]
                ];

            } else if (eid == 0x0006 && length == 5) { //
                return [];

            } else if (eid == 0x0007) { //
                return [];

            } else if (eid == 0x0008) { //
                return [];

            } else if (eid == 0x000B) { //11
                return [];

            } else if (eid == 0x0F && length <= 6) { //15
                if (pdid == 2691) {
                    return [
                        [pdid, Occupancy, [], [p0x0FOccupancy], eid, edata],
                        [pdid, Illuminance, [], [p0x0FIlluminanceOrLight], eid, edata]
                    ];
                } else {
                    return [
                        [pdid, Occupancy, [], [p0x0FOccupancy], eid, edata],
                        [pdid, Light, [], [p0x0FIlluminanceOrLight], eid, edata]
                    ];
                }

            } else if (eid == 0x10 && length == 2) { //16
                return [];

            } else {
                return [];
            }
        };

        return paramStateVal(msg)
            .concat([[msg.pdid, DebugOutput, [], [DebugOutputParser], undefined, msg.edata]])
            .map(([pdid, stateClass, [...stateArgs], stateParsers, eid, edata]) => {
                const parsersFuncs = (stateParsers || [function() {return val => undefined}]).map(f => f(pdid));

                const BleStateClass = class extends stateClass {
                    /* Override */
                    normalizeLeft(val) {
                        const parsersChainFunc = funcs => val => funcs.reduce((p, pf) => pf(p, true), val);
                        return super.normalizeLeft(parsersChainFunc(parsersFuncs)(val));
                    };

                    decode(/* [[ble, val]] */keyVal) {
                        let payload;

                        if (this.resource != undefined) {
                            payload = keyVal
                                .filter(spec => spec[0] == this.resource)
                                .reduce((pv, [, val]) => Object.assign({}, pv, {[this.stateName]: this.normalizeLeft(val)}), {});
                        } else {
                            payload = {[this.stateName]: this.normalizeLeft(keyVal)};
                        }

                        Object.keys(payload).forEach(key => payload[key] === undefined ? delete payload[key] : {});

                        return payload;
                    }

                    /* */
                    constructor(resource, ...stateArgs) {
                        super(...stateArgs);
                        this.resource = resource;
                    }
                };

                const state = new BleStateClass(eid, ...stateArgs);

                return [state, state.decode([[msg.eid, msg.edata]])[state.stateName]];
            });
    }

    /* */
    static getDevice(pdid) {
        const device = this.#DEVICES.find(el => Object.keys(el).includes(`${pdid}`));

        /* I do concatenation internal and external definitions of devices */
        // TODO: external devices definitions
        // const device = [].concat(this.#DEVICES, isArray(extDevices) ? extDevices : [])
        //     .find(el => Object.keys(el).includes(model));

        if (device != undefined) {
            let desc = device[pdid];

            const deviceSpec = (device['spec'] || []).map(spec => {
                const [res, prop, stateClass, [...stateArgs], stateParsers] = spec;
                const parsersFuncs = (stateParsers || [function() {return val => undefined}]).map(f => f(pdid));

                /* define new class which extends state class with bluetooth devices specific functionality */
                const BleStateClass = class extends stateClass {
                    /* Override */
                    normalizeLeft(val) {
                        const parsersChainFunc = funcs => val => funcs.reduce((p, pf) => pf(p, true), val);
                        return super.normalizeLeft(parsersChainFunc(parsersFuncs)(val));
                    };

                    /* Override */
                    normalizeRight(val) {
                        return super.normalizeRight(val);
                    }

                    decode(/* [[ble, val]] */keyVal) {
                        let payload;

                        if (this.resource != undefined) {
                            payload = keyVal
                                .filter(spec => spec[0] == this.resource)
                                .reduce((pv, [, val]) => Object.assign({}, pv, {[this.stateName]: this.normalizeLeft(val)}), {});
                        } else {
                            payload = {[this.stateName]: this.normalizeLeft(keyVal)};
                        }

                        Object.keys(payload).forEach(key => payload[key] === undefined ? delete payload[key] : {});

                        return payload;
                    }

                    /* */
                    constructor(resource, ...stateArgs) {
                        super(...stateArgs);
                        this.resource = resource;
                    }
                };

                /* return device specification array */
                return [
                    res,
                    prop,
                    new BleStateClass(res, ...stateArgs)
                ];
            });

            return {
                'manufacturer': desc[0],
                'name': `${desc[0]} ${desc[1]}`,
                'model': `${desc.length > 2 ? desc[2] : pdid}`,
                'spec': deviceSpec.length > 0 ? deviceSpec : undefined
            };
        } else {
            return {};
        }
    }
};

/* Default parser functions */
function DefaultParser() {
    return val => val;
}

/* */
function DebugOutputParser(model) {
    return val => {
        if (isArray(val)) {
            return JSON.stringify({
                'model': model,
                'bluetooth': (val || []).map(([prop]) => prop)
            });
        } else {
            return undefined;
        }
    };
}

/* Parsers functions */
function p0x1001(pdid) { // eid == 0x1001
    return val => {
        const data = Uint8Array.from(Buffer.from(val, 'hex'));
        // length == 3

        // value = int.from_bytes(data, 'little')
        // return {
        //     'action': ACTIONS[pdid][value]
        //     if pdid in ACTIONS and value in ACTIONS[pdid]
        //     else value
        // }
    };
}

function p0x1002(pdid) { // eid == 0x1002
    return val => {
        const data = Uint8Array.from(Buffer.from(val, 'hex'));
        // length == 1

        // No sleep (0x00), falling asleep (0x01)
        // return {'sleep': data[0]}  # 1 => true
    };
}

function p0x1003LinkQuality(pdid) { // eid == 0x1003 LinkQuality
    return val => {
        const data = Uint8Array.from(Buffer.from(val, 'hex'));
        return data[0];
    };
}

function p0x1005Power(pdid) { // eid == 0x1005 Power
    return val => {
        const data = Uint8Array.from(Buffer.from(val, 'hex'));
        return data[0];
    };
}

function p0x1005Temperature(pdid) { // eid == 0x1005 Temperature
    return val => {
        const data = Uint8Array.from(Buffer.from(val, 'hex'));
        return data[1];
    };
}

function p0x1004Temperature(pdid) { // eid == 0x1004 Temperature
    return val => {
        const data = Uint8Array.from(Buffer.from(val, 'hex'));
        
        if (data.byteLength == 2)
            return Number(Buffer.from(data).readIntLE(0, 2)) / 10.0;
    };
}

function p0x1006Humidity(pdid) { // eid == 0x1006 Humidity
    // Humidity percentage, ranging from 0-1000
    // two models has bug, they increase humidity on each data by 0.1
    if ([903, 1371].includes(pdid)) {
        return val => {
            const data = Uint8Array.from(Buffer.from(val, 'hex'));
            
            if (data.byteLength == 2)
                return Math.floor(Number(Buffer.from(data).readIntLE(0, 2)) / 10.0);
        };
    } else {
        return val => {
            const data = Uint8Array.from(Buffer.from(val, 'hex'));

            if (data.byteLength == 2)
                return Number(Buffer.from(data).readIntLE(0, 2)) / 10.0;
        };
    }
}

function p0x1007IlluminanceOrLight(pdid) { // eid == 0x1007 Illuminance or Light
    if (pdid == 2038) {
        // Night Light 2: 1 - no light, 100 - light
        return val => {
            const data = Uint8Array.from(Buffer.from(val, 'hex'));
            
            if (data.byteLength == 3) {
                const value = Number(Buffer.from(data).readIntLE(0, 3));
                return (Number(Buffer.from(data).readIntLE(0, 3)) >= 100) ? 1 : 0;
            }
        };
    } else {
        // Range: 0-120000, lux
        return val => {
            const data = Uint8Array.from(Buffer.from(val, 'hex'));
            
            if (data.byteLength == 3)
                return Number(Buffer.from(data).readIntLE(0, 3));
        };
    }
}

function p0x1008Moisture(pdid) { // eid == 0x1008 Moisture
    // Humidity percentage, range: 0-100
    return val => {
        const data = Uint8Array.from(Buffer.from(val, 'hex'));
        return data[0];
    };
}

function p0x1009Conductivity(pdid) { // eid == 0x1009
    // Soil EC value, Unit us/cm, range: 0-5000
    return val => {
        const data = Uint8Array.from(Buffer.from(val, 'hex'));
        
        if (data.byteLength == 2)
            return Number(Buffer.from(data).readIntLE(0, 2));
    };
}

function p0x100ABattery(pdid) { // eid == 0x100A Battery
    return val => {
        const data = Uint8Array.from(Buffer.from(val, 'hex'));
        return data[0];
    };
}

function p0x100DTemperature() { // eid == 0x100D Temperature
    return val => {
        const data = Uint8Array.from(Buffer.from(val, 'hex'));
        
        if (data.byteLength == 4)
            return Number(Buffer.from(data.slice(0, 2)).readIntLE(0, 2)) / 10.0;
    };
}

function p0x100DHumidity() { // eid == 0x100D Humidity
    return val => {
        const data = Uint8Array.from(Buffer.from(val, 'hex'));
        
        if (data.byteLength == 4)
            return (Number(Buffer.from(data.slice(-2)).readIntLE(0, 2)) / 10.0);
    };
}

function p0x100E() { // eid == 0x100E
    return val => {
        const data = Uint8Array.from(Buffer.from(val, 'hex'));
        // length == 1

        // 1 => true => on => unlocked
        // 0x00: unlock state (all bolts retracted)
        // TODO: other values
        // return {'lock': 1 if data[0] == 0 else 0}
    };
}

function p0x100F() { // eid == 0x100F Formaldehyde
    return val => {
        const data = Uint8Array.from(Buffer.from(val, 'hex'));
        // length == 1

        // 1 => true => on => dooor opening
        // return {'opening': 1 if data[0] == 0 else 0}
    };
}

function p0x1010Formaldehyde() { // eid == 0x1010 Formaldehyde
    return val => {
        const data = Uint8Array.from(Buffer.from(val, 'hex'));
        
        if (data.byteLength == 2)
            return Number(Buffer.from(data).readIntLE(0, 2)) / 100.0;
    };
}

function p0x1012() { // eid == 0x1012
    return val => {
        const data = Uint8Array.from(Buffer.from(val, 'hex'));
    };
}

function p0x1013Remaining() { // eid == 0x1013 Remaining
    return val => {
        const data = Uint8Array.from(Buffer.from(val, 'hex'));
        
        if (data.byteLength == 1)
            return data[0];
    };
}

function p0x1014Alarm() { // eid == 0x1014 Alarm
    return val => {
        const data = Uint8Array.from(Buffer.from(val, 'hex'));
        
        if (data.byteLength == 1)
            return data[0];
    };
}

function p0x1015Alarm() { // eid == 0x1015 Alarm
    return val => {
        const data = Uint8Array.from(Buffer.from(val, 'hex'));
        
        if (data.byteLength == 1)
            return data[0];
    };
}

function p0x1016Alarm() { // eid == 0x1016 Alarm
    return val => {
        const data = Uint8Array.from(Buffer.from(val, 'hex'));
        
        if (data.byteLength == 1)
            return data[0];
    };
}

function p0x1017IdleTime(pdid) { //eid == 0x1017 IdleTime
    // The duration of the unmanned state, in seconds
    return val => {
        const data = Uint8Array.from(Buffer.from(val, 'hex'));
        
        if (data.byteLength == 4)
            return Number(Buffer.from(data).readIntLE(0, 4));
    };
}

function p0x1018Light(pdid) { //eid == 0x1018 Light
    // Door Sensor 2: 0 - dark, 1 - light
    return val => {
        const data = Uint8Array.from(Buffer.from(val, 'hex'));
        
        if (data.byteLength == 1)
            return data[0] ? 1 : 0;
    };
}

function p0x1019Contact() { // eid == 0x1019 Contact
    // 0x00: open the door, 0x01: close the door,
    // 0x02: not closed after timeout, 0x03: device reset
    // 1 => true => open
    return val => {
        const data = Uint8Array.from(Buffer.from(val, 'hex'));
        
        if (data.byteLength == 1) {
            if (data[0] == 0)
                return 1;
            else if (data[0] == 1)
                return 0;
        }
    };
}

function p0x0006() { // eid == 0x0006
    return val => {
        const data = Uint8Array.from(Buffer.from(val, 'hex'));
        // length == 5

        // action = int.from_bytes(data[4:], 'little')
        // if action >= len(BLE_FINGERPRINT_ACTION):
        //     return None
        // # status, action, state
        // return {
        //     'action': 'fingerprint',
        //     'action_id': action,
        //     'key_id': hex(int.from_bytes(data[:4], 'little')),
        //     'message': BLE_FINGERPRINT_ACTION[action]
        // }
    };
}

function p0x0007() { // eid == 0x0007
    return val => {
        const data = Uint8Array.from(Buffer.from(val, 'hex'));
        // TODO: lock timestamp
        // if data[0] >= len(BLE_DOOR_ACTION):
        //     return None
        // return {
        //     'action': 'door',
        //     'action_id': data[0],
        //     'message': BLE_DOOR_ACTION[data[0]]
        // }
    };
}

function p0x0008() { // eid == 0x0008
    return val => {
        const data = Uint8Array.from(Buffer.from(val, 'hex'));
        // TODO: lock timestamp
        // return {
        //     'action': 'armed',
        //     'state': bool(data[0])
        // }
    };
}

function p0x000B() { // eid == 0x000B
    return val => {
        const data = Uint8Array.from(Buffer.from(val, 'hex'));
        // action = data[0] & 0x0F
        // method = data[0] >> 4
        // key_id = int.from_bytes(data[1:5], 'little')
        // error = BLE_LOCK_ERROR.get(key_id)
        // # all keys except Bluetooth have only 65536 values
        // if error is None and method > 0:
        //     key_id &= 0xFFFF
        // elif error:
        //     key_id = hex(key_id)
        // timestamp = int.from_bytes(data[5:], 'little')
        // timestamp = datetime.fromtimestamp(timestamp).isoformat()
        // if action not in BLE_LOCK_ACTION or method not in BLE_LOCK_METHOD:
        //     return None
        // return {
        //     'action': 'lock',
        //     'action_id': action,
        //     'method_id': method,
        //     'message': BLE_LOCK_ACTION[action],
        //     'method': BLE_LOCK_METHOD[method],
        //     'key_id': key_id,
        //     'error': error,
        //     'timestamp': timestamp
        // }
    };
}

function p0x0FOccupancy(pdid) { //eid == 0x0F Occupancy
    return val => {
        return 1;
    };
}

function p0x0FIlluminanceOrLight(pdid) { //eid == 0x0F Illuminance or Light
    // Night Light 2: 1 - moving no light, 100 - moving with light
    // Motion Sensor 2: 0 - moving no light, 256 - moving with light
    // Qingping Motion Sensor - moving with illuminance data
    if (pdid == 2691) {
        return val => {
            const data = Uint8Array.from(Buffer.from(val, 'hex'));
            const length = data.byteLength;
            
            if (length <= 6)
                return Buffer.from(data).readIntLE(0, length);
        };
    } else {
        return val => {
            const data = Uint8Array.from(Buffer.from(val, 'hex'));
            const length = data.byteLength;

            if (length <= 6) {
                const value = Buffer.from(data).readIntLE(0, length);
                return (value >= 100) ? 1 : 0;
            }
        };
    }
}

function p0x10() { // eid == 0x10
    return val => {
        const data = Uint8Array.from(Buffer.from(val, 'hex'));
        // length == 2

        // # Toothbrush Т500
        // if data[0] == 0:
        //     return {'action': 'start', 'counter': data[1]}
        // else:
        //     return {'action': 'finish', 'score': data[1]}
    };
}