// https://github.com/Koenkk/zigbee-herdsman-converters/blob/master/devices.js#L390
// https://slsys.io/action/devicelists.html
// All lumi models:
//   https://github.com/rytilahti/python-miio/issues/699#issuecomment-643208618

// Zigbee Model: [Manufacturer, Device Name, Device Model]
// params: [lumi res name, xiaomi prop name, iob state]

const RE_ZIGBEE_MODEL_TAIL = /\.v\d$/gm; //re.compile(r'\.v\d$')

/* */
module.exports = class Zigbee {
    
    static #DEVICES = [
        {
            'lumi.gateway.mgl03': ['Xiaomi', 'Gateway 3', 'ZNDMWG03LM'],
            'lumi_spec': [
                ['8.0.2012', undefined, 'power_tx'],
                ['8.0.2024', undefined, 'channel'],
                ['8.0.2081', undefined, 'pairing_stop'],
                ['8.0.2082', undefined, 'removed_did'],
                ['8.0.2084', undefined, 'added_device'],  // new devices added (info)
                ['8.0.2103', undefined, 'device_model'],  // new device model
                ['8.0.2109', undefined, 'pairing_start'],
                ['8.0.2110', undefined, 'discovered_mac'],  // new device discovered
                // ['8.0.2111', undefined, 'pair_command'],  // add new device
                // ['8.0.2155', undefined, 'cloud'],  // {'cloud_link':0}
            ]
        },
        {
            // on/off, power measurement
            'lumi.plug': ['Xiaomi', 'Plug', 'ZNCZ02LM'],  // tested
            'lumi.plug.mitw01': ['Xiaomi', 'Plug TW', 'ZNCZ03LM'],
            'lumi.plug.maus01': ['Xiaomi', 'Plug US', 'ZNCZ12LM'],
            'lumi.ctrl_86plug': ['Aqara', 'Socket', 'QBCZ11LM'],
            // 'lumi.plug.maeu01': ['Aqara', 'Plug EU', 'SP-EUC01'],
            'lumi_spec': [
                [undefined, 'alive', 'available'],
                ['8.0.2007', 'lqi', 'link_quality'],
                ['0.12.85', 'load_power', 'load_power'],
                // ['0.13.85', undefined, 'consumption', 'sensor'],
                ['4.1.85', 'neutral_0', 'switch'],  // or channel_0?
            ]
        },
        {
            'lumi.plug.mmeu01': ['Xiaomi', 'Plug EU', 'ZNCZ04LM'],
            'lumi_spec': [
                [undefined, 'alive', 'available'],
                ['8.0.2007', 'lqi', 'link_quality'],
                ['0.11.85', 'load_voltage', 'load_voltage'],
                ['0.12.85', 'load_power', 'load_power'],
                // ['0.13.85', undefined, 'consumption', 'sensor'],
                ['4.1.85', 'neutral_0', 'switch'],  // or channel_0?
            ]
        },
        {
            'lumi.ctrl_86plug.aq1': ['Aqara', 'Socket', 'QBCZ11LM'],
            'lumi_spec': [
                [undefined, 'alive', 'available'],
                ['8.0.2007', 'lqi', 'link_quality'],
                ['0.12.85', 'load_power', 'load_power'],
                // ['0.13.85', undefined, 'consumption', 'sensor'],
                ['4.1.85', 'channel_0', 'switch'],  // @to4ko
            ]
        },
        {
            'lumi.ctrl_ln1': ['Aqara', 'Single Wall Switch', 'QBKG11LM'],
            'lumi.ctrl_ln1.aq1': ['Aqara', 'Single Wall Switch', 'QBKG11LM'],
            'lumi.switch.b1nacn02': ['Aqara', 'Single Wall Switch D1', 'QBKG23LM'],
            'lumi_spec': [
                [undefined, 'alive', 'available'],
                ['8.0.2007', 'lqi', 'link_quality'],
                ['0.12.85', 'load_power', 'load_power'],
                // ['0.13.85', undefined, 'consumption', 'sensor'],
                ['4.1.85', 'neutral_0', 'switch'],  // or channel_0?
                ['13.1.85', undefined, 'button'],
            ]
        },
        {
            // dual channel on/off, power measurement
            'lumi.relay.c2acn01': ['Aqara', 'Relay', 'LLKZMK11LM'],  // tested
            'lumi.ctrl_ln2': ['Aqara', 'Double Wall Switch', 'QBKG12LM'],
            'lumi.ctrl_ln2.aq1': ['Aqara', 'Double Wall Switch', 'QBKG12LM'],
            'lumi.switch.b2nacn02': ['Aqara', 'Double Wall Switch D1', 'QBKG24LM'],
            'lumi_spec': [
                [undefined, 'alive', 'available'],
                ['8.0.2007', 'lqi', 'link_quality'],
                // ['0.11.85', 'load_voltage', 'power', 'sensor'],  // 0
                ['0.12.85', 'load_power', 'load_power'],
                // ['0.13.85', undefined, 'consumption', 'sensor'],
                // ['0.14.85', undefined, '?', 'sensor'],  // 5.01, 6.13
                ['4.1.85', 'channel_0', 'channel_1'],
                ['4.2.85', 'channel_1', 'channel_2'],
                // [?, 'enable_motor_mode', 'interlock']
                ['13.1.85', undefined, 'button_1'],
                ['13.2.85', undefined, 'button_2'],
                ['13.5.85', undefined, 'button_both'],
            ]
        },
        {
            'lumi.ctrl_neutral1': ['Aqara', 'Single Wall Switch', 'QBKG04LM'],
            'lumi_spec': [
                [undefined, 'alive', 'available'],
                ['8.0.2007', 'lqi', 'link_quality'],
                ['4.1.85', 'neutral_0', 'switch'],  // @vturekhanov
                ['13.1.85', undefined, 'button'],
            ]
        },
        {
            // on/off
            'lumi.switch.b1lacn02': ['Aqara', 'Single Wall Switch D1', 'QBKG21LM'],
            'lumi_spec': [
                [undefined, 'alive', 'available'],
                ['8.0.2007', 'lqi', 'link_quality'],
                ['4.1.85', 'channel_0', 'switch'],  // or neutral_0?
                ['13.1.85', undefined, 'button'],
            ]
        },
        {
            // dual channel on/off
            'lumi.ctrl_neutral2': ['Aqara', 'Double Wall Switch', 'QBKG03LM'],
            'lumi_spec': [
                [undefined, 'alive', 'available'],
                ['8.0.2007', 'lqi', 'link_quality'],
                ['4.1.85', 'neutral_0', 'channel_1'],  // @to4ko
                ['4.2.85', 'neutral_1', 'channel_2'],  // @to4ko
                ['13.1.85', undefined, 'button_1'],
                ['13.2.85', undefined, 'button_2'],
                ['13.5.85', undefined, 'button_both'],
            ]
        },
        {
            'lumi.switch.b2lacn02': ['Aqara', 'Double Wall Switch D1', 'QBKG22LM'],
            'lumi_spec': [
                [undefined, 'alive', 'available'],
                ['8.0.2007', 'lqi', 'link_quality'],
                ['4.1.85', 'channel_0', 'channel_1'],
                ['4.2.85', 'channel_1', 'channel_2'],
                ['13.1.85', undefined, 'button_1'],
                ['13.2.85', undefined, 'button_2'],
                ['13.5.85', undefined, 'button_both'],
            ]
        },
        {
            // triple channel on/off, no neutral wire
            'lumi.switch.l3acn3': ['Aqara', 'Triple Wall Switch D1', 'QBKG25LM'],
            'lumi_spec': [
                [undefined, 'alive', 'available'],
                ['8.0.2007', 'lqi', 'link_quality'],
                ['4.1.85', 'neutral_0', 'channel_1'],  // @to4ko
                ['4.2.85', 'neutral_1', 'channel_2'],  // @to4ko
                ['4.3.85', 'neutral_2', 'channel_3'],  // @to4ko
                ['13.1.85', undefined, 'button_1'],
                ['13.2.85', undefined, 'button_2'],
                ['13.3.85', undefined, 'button_3'],
                ['13.5.85', undefined, 'button_both_12'],
                ['13.6.85', undefined, 'button_both_13'],
                ['13.7.85', undefined, 'button_both_23'],
            ]
        },
        {
            // with neutral wire, thanks @Mantoui
            'lumi.switch.n3acn3': ['Aqara', 'Triple Wall Switch D1', 'QBKG26LM'],
            'lumi_spec': [
                [undefined, 'alive', 'available'],
                ['8.0.2007', 'lqi', 'link_quality'],
                ['0.12.85', 'load_power', 'load_power'],
                // ['0.13.85', undefined, 'consumption', 'sensor'],
                ['4.1.85', 'channel_0', 'channel_1'],
                ['4.2.85', 'channel_1', 'channel_2'],
                ['4.3.85', 'channel_2', 'channel_3'],
                ['13.1.85', undefined, 'button_1'],
                ['13.2.85', undefined, 'button_2'],
                ['13.3.85', undefined, 'button_3'],
                ['13.5.85', undefined, 'button_both_12'],
                ['13.6.85', undefined, 'button_both_13'],
                ['13.7.85', undefined, 'button_both_23'],
            ]
        },
        {
            // cube action, no retain
            'lumi.sensor_cube': ['Aqara', 'Cube', 'MFKZQ01LM'],
            'lumi.sensor_cube.aqgl01': ['Aqara', 'Cube', 'MFKZQ01LM'],  // tested
            'lumi_spec': [
                [undefined, 'alive', 'available'],
                ['8.0.2007', 'lqi', 'link_quality'],
                ['0.2.85', undefined, 'duration'],
                ['0.3.85', undefined, 'angle'],
                ['8.0.2008', 'voltage', 'voltage'],
                ['8.0.2008', 'voltage', 'battery'],
                // ['13.1.85', undefined, 'action', 'sensor'],
            ]
        },
        {
            // light with brightness and color temp
            'lumi.light.aqcn02': ['Aqara', 'Bulb', 'ZNLDP12LM'],
            'lumi.light.cwopcn02': ['Aqara', 'Opple MX650', 'XDD12LM'],
            'lumi.light.cwopcn03': ['Aqara', 'Opple MX480', 'XDD13LM'],
            'ikea.light.led1545g12': ['IKEA', 'Bulb E27 980 lm', 'LED1545G12'],
            'ikea.light.led1546g12': ['IKEA', 'Bulb E27 950 lm', 'LED1546G12'],
            'ikea.light.led1536g5': ['IKEA', 'Bulb E14 400 lm', 'LED1536G5'],
            'ikea.light.led1537r6': ['IKEA', 'Bulb GU10 400 lm', 'LED1537R6'],
            'lumi_spec': [
                [undefined, 'alive', 'available'],
                ['8.0.2007', 'lqi', 'link_quality'],
                ['4.1.85', 'power_status', 'switch'],
                ['14.1.85', 'light_level', 'brightness'],
                ['14.2.85', 'colour_temperature', 'color_temperature'], // colour???
            ]
        },
        {
            // light with brightness
            'ikea.light.led1623g12': ['IKEA', 'Bulb E27 1000 lm', 'LED1623G12'],
            'ikea.light.led1650r5': ['IKEA', 'Bulb GU10 400 lm', 'LED1650R5'],
            'ikea.light.led1649c5': ['IKEA', 'Bulb E14', 'LED1649C5'],  // tested
            'lumi_spec': [
                [undefined, 'alive', 'available'],
                ['8.0.2007', 'lqi', 'link_quality'],
                ['4.1.85', 'power_status', 'switch'],
                ['14.1.85', 'light_level', 'brightness'],
            ]
        },
        {
            // button action, no retain
            'lumi.sensor_switch': ['Xiaomi', 'Button', 'WXKG01LM'],
            'lumi.sensor_switch.aq2': ['Aqara', 'Button', 'WXKG11LM'],
            'lumi.remote.b1acn01': ['Aqara', 'Button', 'WXKG11LM'],
            'lumi.sensor_switch.aq3': ['Aqara', 'Shake Button', 'WXKG12LM'],
            'lumi.sensor_86sw1': ['Aqara', 'Single Wall Button', 'WXKG03LM'],
            'lumi.remote.b186acn01': ['Aqara', 'Single Wall Button', 'WXKG03LM'],
            'lumi.remote.b186acn02': ['Aqara', 'Single Wall Button D1', 'WXKG06LM'],
            'lumi_spec': [
                [undefined, 'alive', 'available'],
                ['8.0.2007', 'lqi', 'link_quality'],
                ['13.1.85', undefined, 'button'],
                ['8.0.2008', 'voltage', 'voltage'],
                ['8.0.2008', 'voltage', 'battery'],
            ]
        },
        {
            // multi button action, no retain
            'lumi.sensor_86sw2': ['Aqara', 'Double Wall Button', 'WXKG02LM'],
            'lumi.remote.b286acn01': ['Aqara', 'Double Wall Button', 'WXKG02LM'],
            'lumi.sensor_86sw2.es1': ['Aqara', 'Double Wall Button', 'WXKG02LM'],
            'lumi.remote.b286acn02': ['Aqara', 'Double Wall Button D1', 'WXKG07LM'],
            'lumi.remote.b286opcn01': ['Aqara', 'Opple Two Button', 'WXCJKG11LM'],
            'lumi.remote.b486opcn01': ['Aqara', 'Opple Four Button', 'WXCJKG12LM'],
            'lumi.remote.b686opcn01': ['Aqara', 'Opple Six Button', 'WXCJKG13LM'],
            'lumi_spec': [
                [undefined, 'alive', 'available'],
                ['8.0.2007', 'lqi', 'link_quality'],
                ['13.1.85', undefined, 'button_1'],
                ['13.2.85', undefined, 'button_2'],
                ['13.3.85', undefined, 'button_3'],
                ['13.4.85', undefined, 'button_4'],
                ['13.6.85', undefined, 'button_5'],
                ['13.7.85', undefined, 'button_6'],
                ['13.5.85', undefined, 'button_both'],
                ['8.0.2008', 'voltage', 'voltage'],
                ['8.0.2008', 'voltage', 'battery'],
            ]
        },
        {
            // temperature and humidity sensor
            'lumi.sensor_ht': ['Xiaomi', 'TH Sensor', 'WSDCGQ01LM'],
            'lumi_spec': [
                [undefined, 'alive', 'available'],
                ['8.0.2007', 'lqi', 'link_quality'],
                ['0.1.85', 'temperature', 'temperature'],
                ['0.2.85', 'humidity', 'humidity'],
                ['8.0.2008', 'voltage', 'voltage'],
                ['8.0.2008', 'voltage', 'battery'],
            ]
        },
        {
            // temperature, humidity and pressure sensor
            'lumi.weather': ['Aqara', 'TH Sensor', 'WSDCGQ11LM'],
            'lumi.sensor_ht.agl02': ['Aqara', 'TH Sensor', 'WSDCGQ12LM'],
            'lumi_spec': [
                [undefined, 'alive', 'available'],
                ['8.0.2007', 'lqi', 'link_quality'],
                ['0.1.85', 'temperature', 'temperature'],
                ['0.2.85', 'humidity', 'humidity'],
                ['0.3.85', 'pressure', 'pressure'],
                ['8.0.2008', 'voltage', 'voltage'],
                ['8.0.2008', 'voltage', 'battery'],
            ]
        },
        {
            // door window sensor
            'lumi.sensor_magnet': ['Xiaomi', 'Door Sensor', 'MCCGQ01LM'],
            'lumi.sensor_magnet.aq2': ['Aqara', 'Door Sensor', 'MCCGQ11LM'],
            'lumi_spec': [
                [undefined, 'alive', 'available'],
                ['8.0.2007', 'lqi', 'link_quality'],
                ['3.1.85', 'status', 'contact'],
                ['8.0.2008', 'voltage', 'voltage'],
                ['8.0.2008', 'voltage', 'battery'],
            ]
        },
        {
            // motion sensor
            'lumi.sensor_motion': ['Xiaomi', 'Motion Sensor', 'RTCGQ01LM'],
            'lumi_spec': [
                [undefined, 'alive', 'available'],
                ['8.0.2007', 'lqi', 'link_quality'],
                ['3.1.85', undefined, 'occupancy'],
                ['8.0.2008', 'voltage', 'voltage'],
                ['8.0.2008', 'voltage', 'battery'],
            ]
        },
        {
            // motion sensor with illuminance
            'lumi.sensor_motion.aq2': ['Aqara', 'Motion Sensor', 'RTCGQ11LM'],
            'lumi_spec': [
                [undefined, 'alive', 'available'],
                ['8.0.2007', 'lqi', 'link_quality'],
                // ['0.3.85', 'lux', 'illuminance_lux'],
                ['0.4.85', 'illumination', 'illuminance'],
                ['3.1.85', undefined, 'occupancy'],
                ['8.0.2008', 'voltage', 'voltage'],
                ['8.0.2008', 'voltage', 'battery'],
                [undefined, undefined, 'no_motion'], // number, seconds
                [undefined, undefined, 'occupancy_timeout'] // number, seconds
            ]
        },
        {
            // water leak sensor
            'lumi.sensor_wleak.aq1': ['Aqara', 'Water Leak Sensor', 'SJCGQ11LM'],
            'lumi_spec': [
                [undefined, 'alive', 'available'],
                ['8.0.2007', 'lqi', 'link_quality'],
                ['3.1.85', 'alarm', 'water_leak'], //moisture?
                ['8.0.2008', 'voltage', 'voltage'],
                ['8.0.2008', 'voltage', 'battery'],
            ]
        },
        {
            // vibration sensor
            'lumi.vibration.aq1': ['Aqara', 'Vibration Sensor', 'DJT11LM'],
            'lumi_spec': [
                [undefined, 'alive', 'available'],
                ['8.0.2007', 'lqi', 'link_quality'],
                ['0.1.85', undefined, 'bed_activity'], // TODO:
                ['0.2.85', undefined, 'tilt_angle'], // TODO:
                ['0.3.85', undefined, 'vibrate_intensity'], // TODO:
                ['13.1.85', undefined, 'vibration'], // TODO:
                ['14.1.85', undefined, 'vibration_level'], // TODO:
                ['8.0.2008', 'voltage', 'voltage'],
                ['8.0.2008', 'voltage', 'battery'],
            ]
        },
        {
            'lumi.sen_ill.mgl01': ['Xiaomi', 'Light Sensor', 'GZCGQ01LM'],
            'miot_spec': [
                [undefined, 'alive', 'available'],
                ['2.1', '2.1', 'illuminance'],
                ['3.1', '3.1', 'battery'],
            ]
        },
        {
            'lumi.sensor_smoke': ['Honeywell', 'Smoke Sensor', 'JTYJ-GD-01LM/BW'],
            'lumi_spec': [
                [undefined, 'alive', 'available'],
                ['8.0.2007', 'lqi', 'link_quality'],
                // ['0.1.85', 'density', 'smoke density', 'sensor'], ??
                ['13.1.85', 'alarm', 'smoke'], // smoke?
                ['8.0.2008', 'voltage', 'voltage'],
                ['8.0.2008', 'voltage', 'battery'],
            ]
        },
        {
            'lumi.sensor_natgas': ['Honeywell', 'Gas Sensor', 'JTQJ-BF-01LM/BW'],
            'lumi_spec': [
                ['8.0.2007', 'lqi', 'link_quality'],
                // ['0.1.85', 'density', 'gas density', 'sensor'], ??
                ['13.1.85', 'alarm', 'gas'], // gas?
            ]
        },
        {
            'lumi.curtain': ['Aqara', 'Curtain', 'ZNCLDJ11LM'],
            'lumi.curtain.aq2': ['Aqara', 'Roller Shade', 'ZNGZDJ11LM'],
            'lumi_spec': [
                [undefined, 'alive', 'available'],
                ['8.0.2007', 'lqi', 'link_quality'],
                ['1.1.85', 'curtain_level', 'position'], // TODO:
                // ['14.2.85', undefined, 'motor', 'cover'],
                ['14.3.85', 'cfg_param', 'cfg_param'], // TODO:
                ['14.4.85', 'run_state', 'run_state'], // TODO:
            ]
        },
        {
            'lumi.curtain.hagl04': ['Aqara', 'Curtain B1', 'ZNCLDJ12LM'],
            'lumi_spec': [
                [undefined, 'alive', 'available'],
                ['8.0.2007', 'lqi', 'link_quality'],
                ['1.1.85', 'curtain_level', 'position'], // TODO:
                // ['14.2.85', undefined, 'motor', 'cover'],
                ['14.3.85', 'cfg_param', 'cfg_param'], // TODO:
                ['14.4.85', 'run_state', 'run_state'], // TODO:
                ['8.0.2008', 'voltage', 'voltage'],
                ['8.0.2008', 'voltage', 'battery'],
            ]
        },
        {
            'lumi.lock.aq1': ['Aqara', 'Door Lock S1', 'ZNMS11LM'],
            'lumi.lock.acn02': ['Aqara', 'Door Lock S2', 'ZNMS12LM'],
            'lumi.lock.acn03': ['Aqara', 'Door Lock S2 Pro', 'ZNMS12LM'],
            'lumi_spec': [
                [undefined, 'alive', 'available'],
                ['8.0.2007', 'lqi', 'link_quality'],
                // ['13.1.85', undefined, 'key_id', 'sensor'],
                ['13.20.85', 'lock_state', 'lock_state'],
                ['8.0.2008', 'voltage', 'voltage'],
                ['8.0.2008', 'voltage', 'battery'],
            ]
        },
        {
            // https://github.com/AlexxIT/XiaomiGateway3/issues/101
            'lumi.airrtc.tcpecn02': ['Aqara', 'Thermostat S2', 'KTWKQ03ES'],
            'lumi_spec': [
                [undefined, 'alive', 'available'],
                ['8.0.2007', 'lqi', 'link_quality'],
                // ['3.1.85', 'power_status', 'power'],
                ['3.2.85', undefined, 'current_temperature'], // TODO:
                // ['14.2.85', 'ac_state', 'climate', 'climate'],
                ['14.8.85', undefined, 'mode'], // TODO: ???
                ['14.9.85', undefined, 'target_temperature'], // TODO:
                ['14.10.85', undefined, 'fan_mode'], // TODO: ???
            ]
        },
        {
            'lumi.airrtc.vrfegl01': ['Xiaomi', 'VRF Air Conditioning'],
            'lumi_spec': [
                [undefined, 'alive', 'available'],
                ['8.0.2007', 'lqi', 'link_quality'],
                // ['13.1.85', undefined, 'channels', 'sensor']
            ]
        },
        {
            // no N, https://www.aqara.com/en/single_switch_T1_no-neutral.html
            'lumi.switch.l0agl1': ['Aqara', 'Relay T1', 'SSM-U02'],
            'miot_spec': [
                ['2.1', '2.1', 'switch'],
            ]
        },
        {
            // with N, https://www.aqara.com/en/single_switch_T1_with-neutral.html
            'lumi.switch.n0agl1': ['Aqara', 'Relay T1', 'SSM-U01'],
            'lumi.plug.maeu01': ['Aqara', 'Plug', 'SP-EUC01'],
            'miot_spec': [
                ['2.1', '2.1', 'switch'],
                // ['3.1', '3.1', 'consumption', 'sensor'],
                ['3.2', '3.2', 'load_power'],
                // ['5.7', '5.7', 'voltage', 'sensor'],
            ]
        },
        // {
        //     'lumi.motion.agl04': ['Aqara', 'Precision Motion Sensor', 'RTCGQ13LM'],
        //     'mi_spec': [
        //         [undefined, undefined, 'occupancy'],
        //         ['3.1', '3.1', 'battery'],
        //         ['4.1', undefined, 'motion: 1'],
        //     ]
        // },
        {
            'lumi.airmonitor.acn01': ['Aqara', 'TVOC Air Quality Monitor', 'VOCKQJK11LM'],
            'miot_spec': [
                ['3.1', '3.1', 'temperature'],
                ['3.2', '3.2', 'humidity'],
                // ['3.3', '3.3', 'tvoc', 'sensor'],
                ['4.1', '4.1', 'alarm'], //tvoc_level
                ['4.2', '4.2', 'battery'],
            ]
        },
        {
            'lumi.switch.b1lc04': ['Aqara', 'Single Wall Switch E1', 'QBKG38LM'],
            'miot_spec': [
                ['2.1', '2.1', 'switch'],
                ['6.1', undefined, 'button: 1'],
                ['6.2', undefined, 'button: 2'],
            ]
        },
        {
            'lumi.switch.b2lc04': ['Aqara', 'Double Wall Switch E1', 'QBKG39LM'],
            'miot_spec': [
                ['2.1', '2.1', 'channel_1'],
                ['3.1', '3.1', 'channel_2'],
                ['7.1', undefined, 'button_1: 1'],
                ['7.2', undefined, 'button_1: 2'],
                ['8.1', undefined, 'button_2: 1'],
                ['8.2', undefined, 'button_2: 2'],
                ['9.1', undefined, 'button_both: 4'],
            ]
        }
    ];

    // static #GLOBAL_PROP = {
    //     '8.0.2001': 'battery',
    //     '8.0.2002': 'reset_cnt',
    //     '8.0.2003': 'send_all_cnt',
    //     '8.0.2004': 'send_fail_cnt',
    //     '8.0.2005': 'send_retry_cnt',
    //     '8.0.2006': 'chip_temperature',
    //     '8.0.2008': 'voltage',
    //     '8.0.2009': 'pv_state',
    //     '8.0.2010': 'cur_state',
    //     '8.0.2011': 'pre_state',
    //     '8.0.2013': 'CCA',
    //     '8.0.2014': 'protect',
    //     '8.0.2015': 'power',
    //     '8.0.2022': 'fw_ver',
    //     '8.0.2023': 'hw_ver',
    //     '8.0.2030': 'poweroff_memory',
    //     '8.0.2031': 'charge_protect',
    //     '8.0.2032': 'en_night_tip_light',
    //     '8.0.2034': 'load_s0',  // ctrl_dualchn
    //     '8.0.2035': 'load_s1',  // ctrl_dualchn
    //     '8.0.2036': 'parent',
    //     '8.0.2041': 'model',
    //     '8.0.2042': 'max_power',
    //     '8.0.2044': 'plug_detection',
    //     '8.0.2101': 'nl_invert',  // ctrl_86plug
    //     '8.0.2102': 'alive',
    //     '8.0.2157': 'network_pan_id',
    //     '8.0.9001': 'battery_end_of_life'
    // };

    static CLUSTERS = {
        0x0000: 'Basic',
        0x0001: 'PowerCfg',
        0x0003: 'Identify',
        0x0006: 'OnOff',
        0x0008: 'LevelCtrl',
        0x000A: 'Time',
        0x000C: 'AnalogInput', // cube, gas sensor
        0x0012: 'Multistate',
        0x0019: 'OTA', // illuminance sensor
        0x0101: 'DoorLock',
        0x0400: 'Illuminance', // motion sensor
        0x0402: 'Temperature',
        0x0403: 'Pressure',
        0x0405: 'Humidity',
        0x0406: 'Occupancy', // motion sensor
        0x0500: 'IasZone', // gas sensor
        0x0B04: 'ElectrMeasur',
        0xFCC0: 'Xiaomi'
    };

    static getDevice(model) {
        if (String(model).match(RE_ZIGBEE_MODEL_TAIL) != undefined) model = model.substr(0, model.length-3);

        const device = this.#DEVICES.find(el => Object.keys(el).includes(model));

        if (device != undefined) {
            let desc = device[model];
            
            return {
                'manufacturer': `${desc[0]}`,
                'name': `${desc[0]} ${desc[1]}`,
                'model': `${desc.length > 2 ? desc[2] : model}`,
                'lumi_spec': device.lumi_spec,
                'miot_spec': device.miot_spec
            };
        } else {
            return {
                'name': `Zigbee`,
                'model': model,
                'lumi_spec': undefined,
                'miot_spec': undefined
            };
        }
    }

    static fixXiaomiProps(model, params) {
        for (let k of Object.keys(params)) {
            const v = params[k];

            if (['temperature', 'humidity', 'pressure'].includes(k)) {
                if (model != 'lumi.airmonitor.acn01')
                    params[k] = v / 100;
            } else if (k == 'angle') {
                // # xiaomi cube 100 points = 360 degrees
                params[k] = (v * 4);
            } else if (k == 'duration') {
                // # xiaomi cube
                params[k] = (v / 1000.0);
            } else if (['consumption', 'power'].includes(k)) {
                if (typeof v === 'number')
                    params[k] = v.toFixed(2);
                else
                    params[k] = parseFloat(v).toFixed(2);
            } else if (['on', 'open'].includes(v)) {
                params[k] = 1;
            } else if (['off', 'close'].includes(v)) {
                params[k] = 0;
            } else if (k == 'voltage') {
                params[k] = Number(Number(v / 1000).toFixed(3));
            /* New battery % formula */
            } else if (k == 'battery' && v != undefined) {
                if (v <= 100)
                    params[k] = v;
                else if (v <= 2700)
                    params[k] = 0;
                else if (v >= 3200)
                    params[k] = 100;
                else                    
                    params[k] = Math.round((v - 2700) / 5);
            } else if (k == 'run_state') {
                // # https://github.com/AlexxIT/XiaomiGateway3/issues/139
                if (v == 'offing')
                    params[k] = 0;
                else if (v == 'oning')
                    params[k] = 1;
                else
                    params[k] = 2;
            }
        };

        return params;
    }
};
