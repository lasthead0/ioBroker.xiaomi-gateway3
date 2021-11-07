// Bluetooth Model: [Manufacturer, Device Name, Device Model]
// params: [eid, , iob state] for BLE
// params: ['siid.piid', , iob state] for Mash

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
            '2701': ['Xiaomi', 'Motion Sensor 2', 'RTCGQ02LM'],  // 15,4119,4120
            '2888': ['Xiaomi', 'Qingping TH Sensor', 'CGG1'],  //same model as 839?!
        },
        {
            '1371': ['Xiaomi', 'TH Sensor 2', 'LYWSD03MMC'],
            'ble_spec': [
                [0x1004, undefined, 'temperature'], //4100
                [0x1006, undefined, 'humidity'], //4102
                [0x100A, undefined, 'battery'] //4106
            ]
        },
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
            'miot_spec': [
                ['2.1', undefined, 'light'],
                ['2.2', undefined, 'brightness'],
                ['2.3', undefined, 'color_temp'],
            ]
        },
        {
            // Mesh Switches
            1946: ['Xiaomi', 'Mesh Double Wall Switch', 'DHKG02ZM'],
            'miot_spec': [
                ['2.1', undefined, 'left_switch'],
                ['3.1', undefined, 'right_switch'],
            ]
        },
        {
            1945: ['Xiaomi', 'Mesh Wall Switch', 'DHKG01ZM'],
            2007: ['Unknown', 'Mesh Switch Controller', 'lemesh.switch.sw0a01'],
            3150: ['XinGuang', 'Mesh Switch', 'wainft.switch.sw0a01'],
            'miot_spec': [
                ['2.1', undefined, 'switch']
            ],
        },
        {
            2093: ['PTX', 'Mesh Triple Wall Switch', 'PTX-TK3/M'],
            3878: ['PTX', 'Mesh Triple Wall Switch', 'PTX-SK3M'],
            'miot_spec': [
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
            'miot_spec': [
                ['2.1', undefined, 'left_switch'],
                ['3.1', undefined, 'right_switch'],
                ['8.1', undefined, 'backlight'],
                ['8.2', undefined, 'left_smart'],
                ['8.3', undefined, 'right_smart'],
            ]
        },
        {
            2258: ['PTX', 'Mesh Single Wall Switch', 'PTX-SK1M'],
            'miot_spec': [
                ['2.1', undefined, 'switch'],
                ['8.1', undefined, 'backlight'],
                ['8.2', undefined, 'smart'],
            ]
        },
        {
            2717: ['Xiaomi', 'Mesh Triple Wall Switch', 'ZNKG03HL/ISA-KG03HL'],
            'miot_spec': [
                ['2.1', undefined, 'left_switch'],
                ['3.1', undefined, 'middle_switch'],
                ['4.1', undefined, 'right_switch'],
                ['6.1', undefined, 'humidity'],
                ['6.7', undefined, 'temperature'],
            ]
        },
        {
            3083: ['Xiaomi', 'Mi Smart Electrical Outlet', 'ZNCZ01ZM'],
            'miot_spec': [
                ['2.1', undefined, 'outlet'],
                ['3.1', undefined, 'power'],
                ['4.1', undefined, 'backlight'],
            ]
        },
        {
            2715: ['Xiaomi', 'Mesh Single Wall Switch', 'ZNKG01HL'],
            'miot_spec': [
                ['2.1', undefined, 'switch'],
                ['6.1', undefined, 'humidity'],
                ['6.7', undefined, 'temperature'],
            ]
        },
        {
            2716: ['Xiaomi', 'Mesh Double Wall Switch', 'ZNKG02HL'],
            'miot_spec': [
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
    static parseXiaomiBle(msg) {
        const {eid, edata, pdid} = msg;
        const data = Uint8Array.from(Buffer.from(edata, 'hex'));
        const length = data.byteLength;

        if (eid == 0x1001 && length == 3) { //4097
            return {};
        //     value = int.from_bytes(data, 'little')
        //     return {
        //         'action': ACTIONS[pdid][value]
        //         if pdid in ACTIONS and value in ACTIONS[pdid]
        //         else value
        //     }
        /* */
        } else if (eid == 0x1002 && length == 1) { // 4098
        //     # No sleep (0x00), falling asleep (0x01)
        //     return {'sleep': data[0]}  # 1 => true

        } else if (eid == 0x1003 && length == 1) { //4099
            // Signal strength value
            return {'link_quality': data[0]};

        } else if (eid == 0x1004 && length == 2) { //4100        
            return {
                'temperature': (Number(Buffer.from(data).readIntLE(0, 2)) / 10.0)
            };

        } else if (eid == 0x1005 && length == 2) { //4101
            // Kettle, thanks https://github.com/custom-components/ble_monitor/
            return {
                'power': data[0],
                'temperature': data[1]
            };

        } else if (eid == 0x1006 && length == 2) { //4102
            // Humidity percentage, ranging from 0-1000
            let value = (Number(Buffer.from(data).readIntLE(0, 2)) / 10.0);

            // two models has bug, they increase humidity on each data by 0.1
            if ([903, 1371].includes(pdid))
                value = Math.floor(value);

            return {'humidity': value};

        } else if (eid == 0x1007 && length == 3) { //4103
            const value = Number(Buffer.from(data).readIntLE(0, 3));
            
            if (pdid == 2038)
                // Night Light 2: 1 - no light, 100 - light
                return {'light': (value >= 100) ? 1 : 0};

            // Range: 0-120000, lux
            return {'illuminance': value};

        } else if (eid == 0x1008 && length == 1) { //4104
            // Humidity percentage, range: 0-100
            return {'moisture': data[0]};

        } else if (eid == 0x1009 && length == 2) { //4105
            // Soil EC value, Unit us/cm, range: 0-5000
            return {'conductivity': Number(Buffer.from(data).readIntLE(0, 2))};

        } else if (eid == 0x100A) {  // 4106
            // # TODO: lock timestamp
            return {'battery': data[0]};

        } else if (eid == 0x100D && length == 4) { //4109
            return {
                'temperature': (Number(Buffer.from(data.slice(0, 2)).readIntLE(0, 2)) / 10.0),
                'humidity': (Number(Buffer.from(data.slice(-2)).readIntLE(0, 2)) / 10.0)
            };

        } else if (eid == 0x100E && length == 1) { //4110
        //     # 1 => true => on => unlocked
        //     # 0x00: unlock state (all bolts retracted)
        //     # TODO: other values
        //     return {'lock': 1 if data[0] == 0 else 0}

        } else if (eid == 0x100F && length == 1) { //4111
        //     # 1 => true => on => dooor opening
        //     return {'opening': 1 if data[0] == 0 else 0}

        } else if (eid == 0x1010 && length == 2) { //4112
            return {'formaldehyde': (Number(Buffer.from(data).readIntLE(0, 2)) / 100.0)};

        } else if (eid == 0x1012 && length == 1) { //4114
        //     return {'opening': data[0]}  # 1 => true => open

        } else if (eid == 0x1013 && length == 1) { //4115
            // Remaining percentage, range 0~100
            return {'remaining': data[0]};

        } else if (eid == 0x1014 && length == 1) { //4116
            return {'water_leak': data[0]}; // 1 => on => wet

        } else if (eid == 0x1015 && length == 1) { //4117
            // TODO: equipment failure (0x02)
            return {'smoke': data[0]}; // 1 => on => alarm

        } else if (eid == 0x1016 && length == 1) { //4118
            return {'gas': data[0]}; // 1 => on => alarm

        } else if (eid == 0x1017 && length == 4) { //4119
            // The duration of the unmanned state, in seconds
            return {'idle_time': Number(Buffer.from(data).readIntLE(0, 4))};

        } else if (eid == 0x1018 && length == 1) { //4120
            // Door Sensor 2: 0 - dark, 1 - light
            return {'light': data[0] ? 1 : 0};

        } else if (eid == 0x1019 && length == 1) { //4121
            // 0x00: open the door, 0x01: close the door,
            // 0x02: not closed after timeout, 0x03: device reset
            // 1 => true => open
            if (data[0] == 0)
                return {'contact': 1};
            else if (data[0] == 1)
                return {'contact': 0};
            else
                return {};

        } else if (eid == 0x0006 && length == 5) {
        //     action = int.from_bytes(data[4:], 'little')
        //     if action >= len(BLE_FINGERPRINT_ACTION):
        //         return None
        //     # status, action, state
        //     return {
        //         'action': 'fingerprint',
        //         'action_id': action,
        //         'key_id': hex(int.from_bytes(data[:4], 'little')),
        //         'message': BLE_FINGERPRINT_ACTION[action]
        //     }

        } else if (eid == 0x0007) {
        //     # TODO: lock timestamp
        //     if data[0] >= len(BLE_DOOR_ACTION):
        //         return None
        //     return {
        //         'action': 'door',
        //         'action_id': data[0],
        //         'message': BLE_DOOR_ACTION[data[0]]
        //     }

        } else if (eid == 0x0008) {
        //     # TODO: lock timestamp
        //     return {
        //         'action': 'armed',
        //         'state': bool(data[0])
        //     }

        } else if (eid == 0x000B) { //11
        //     action = data[0] & 0x0F
        //     method = data[0] >> 4
        //     key_id = int.from_bytes(data[1:5], 'little')
        //     error = BLE_LOCK_ERROR.get(key_id)
        //     # all keys except Bluetooth have only 65536 values
        //     if error is None and method > 0:
        //         key_id &= 0xFFFF
        //     elif error:
        //         key_id = hex(key_id)
        //     timestamp = int.from_bytes(data[5:], 'little')
        //     timestamp = datetime.fromtimestamp(timestamp).isoformat()
        //     if action not in BLE_LOCK_ACTION or method not in BLE_LOCK_METHOD:
        //         return None
        //     return {
        //         'action': 'lock',
        //         'action_id': action,
        //         'method_id': method,
        //         'message': BLE_LOCK_ACTION[action],
        //         'method': BLE_LOCK_METHOD[method],
        //         'key_id': key_id,
        //         'error': error,
        //         'timestamp': timestamp
        //     }

        } else if (eid == 0x0F && length <= 6) { //15
            // Night Light 2: 1 - moving no light, 100 - moving with light
            // Motion Sensor 2: 0 - moving no light, 256 - moving with light
            // Qingping Motion Sensor - moving with illuminance data
            const value = Buffer.from(data).readIntLE(0, length);

            if (pdid == 2691)
                return {'occupancy': 1, 'illuminance': value};
            else
                return {'occupancy': 1, 'light': (value >= 100) ? 1 : 0};

        } else if (eid == 0x10 && length == 2) { //16
        //     # Toothbrush Т500
        //     if data[0] == 0:
        //         return {'action': 'start', 'counter': data[1]}
        //     else:
        //         return {'action': 'finish', 'score': data[1]}

        } else {
            return undefined;
        }
    }

    static getDevice(pdid) {
        const device = this.#DEVICES.find(el => Object.keys(el).includes(`${pdid}`));

        if (device != undefined) {
            let desc = device[pdid];

            return {
                'manufacturer': desc[0],
                'name': `${desc[0]} ${desc[1]}`,
                'model': `${desc.length > 2 ? desc[2] : pdid}`,
                'lumi_spec': device.ble_spec,
                'miot_spec': undefined
            };
        } else {
            return {};
        }
    }
};