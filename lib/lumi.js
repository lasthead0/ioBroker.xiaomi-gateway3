'use strict';

const {isArray, isObject} = require('./tools');

const {
    Alarm,
    Available,
    Battery,
    Brightness,
    Button,
    Channel,
    ColorTemperature,
    Conductivity,
    Contact,
    CurtainLevel,
    CurtainMotor,
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
    Power,
    Pressure,
    Remaining,
    RunState,
    Switch,
    Temperature,
    Timeout,
    Voltage,
    /* */
    DebugOutput,
    MessagesStat
} = require('./stateClass');

// https://github.com/Koenkk/zigbee-herdsman-converters/blob/master/devices.js#L390
// https://slsys.io/action/devicelists.html
// All lumi models:
//   https://github.com/rytilahti/python-miio/issues/699#issuecomment-643208618

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
 *     <state class> - (Class) State class which provide interaction with ioBroker state.
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

const RE_ZIGBEE_MODEL_TAIL = /\.v\d$/gm; //re.compile(r'\.v\d$')

/* */
module.exports = class Zigbee {
    
    static #DEVICES = [
        {
            'lumi.gateway.mgl03': ['Xiaomi', 'Gateway 3', 'ZNDMWG03LM'],
            'spec': [
                // ['8.0.2012', undefined, 'power_tx'],
                // ['8.0.2024', undefined, 'channel'],
                // ['8.0.2081', undefined, 'pairing_stop'],
                // ['8.0.2082', undefined, 'removed_did'],
                // ['8.0.2084', undefined, 'added_device'],  // new devices added (info)
                // ['8.0.2103', undefined, 'device_model'],  // new device model
                // ['8.0.2109', undefined, 'pairing_start'],
                // ['8.0.2110', undefined, 'discovered_mac'],  // new device discovered
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
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                ['0.12.85', 'load_power', LoadPower, [], [DefaultParser]],
                // ['0.13.85', undefined, 'consumption', 'sensor'],
                ['4.1.85', 'neutral_0', Switch, [], [SwitchParser]],  // or channel_0?
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            'lumi.plug.mmeu01': ['Xiaomi', 'Plug EU', 'ZNCZ04LM'],
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                ['0.11.85', 'load_voltage', LoadVoltage, [], [DefaultParser]],
                ['0.12.85', 'load_power', LoadPower, [], [DefaultParser]],
                // ['0.13.85', undefined, 'consumption', 'sensor'],
                ['4.1.85', 'neutral_0', Switch, [], [SwitchParser]],  // or channel_0?
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            'lumi.ctrl_86plug.aq1': ['Aqara', 'Socket', 'QBCZ11LM'],
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                ['0.12.85', 'load_power', LoadPower, [], [DefaultParser]],
                // ['0.13.85', undefined, 'consumption', 'sensor'],
                ['4.1.85', 'channel_0', Switch, [], [SwitchParser]],  // @to4ko
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            'lumi.ctrl_ln1': ['Aqara', 'Single Wall Switch', 'QBKG11LM'],
            'lumi.ctrl_ln1.aq1': ['Aqara', 'Single Wall Switch', 'QBKG11LM'],
            'lumi.switch.b1nacn02': ['Aqara', 'Single Wall Switch D1', 'QBKG23LM'],
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                ['0.12.85', 'load_power', LoadPower, [], [DefaultParser]],
                // ['0.13.85', undefined, 'consumption', 'sensor'],
                ['4.1.85', 'neutral_0', Switch, [], [SwitchParser]],  // or channel_0?
                // ['13.1.85', undefined, 'button'],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            // dual channel on/off, power measurement
            'lumi.relay.c2acn01': ['Aqara', 'Relay', 'LLKZMK11LM'],  // tested
            'lumi.ctrl_ln2': ['Aqara', 'Double Wall Switch', 'QBKG12LM'],
            'lumi.ctrl_ln2.aq1': ['Aqara', 'Double Wall Switch', 'QBKG12LM'],
            'lumi.switch.b2nacn02': ['Aqara', 'Double Wall Switch D1', 'QBKG24LM'],
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                // ['0.11.85', 'load_voltage', 'power', 'sensor'],  // 0
                ['0.12.85', 'load_power', LoadPower, [], [DefaultParser]],
                // ['0.13.85', undefined, 'consumption', 'sensor'],
                // ['0.14.85', undefined, '?', 'sensor'],  // 5.01, 6.13
                ['4.1.85', 'channel_0', Channel, ['channel_1', {name: 'Channel 1 state'}], [DefaultParser]],
                ['4.2.85', 'channel_1', Channel, ['channel_2', {name: 'Channel 2 state'}], [DefaultParser]],
                // [?, 'enable_motor_mode', 'interlock']
                // ['13.1.85', undefined, 'button_1'],
                // ['13.2.85', undefined, 'button_2'],
                // ['13.5.85', undefined, 'button_both'],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            'lumi.ctrl_neutral1': ['Aqara', 'Single Wall Switch', 'QBKG04LM'],
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                ['4.1.85', 'neutral_0', Switch, [], [SwitchParser]],  // @vturekhanov
                // ['13.1.85', undefined, 'button'],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            // on/off
            'lumi.switch.b1lacn02': ['Aqara', 'Single Wall Switch D1', 'QBKG21LM'],
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                ['4.1.85', 'channel_0', Switch, [], [SwitchParser]],  // or neutral_0?
                // ['13.1.85', undefined, 'button'],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            // dual channel on/off
            'lumi.ctrl_neutral2': ['Aqara', 'Double Wall Switch', 'QBKG03LM'],
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                ['4.1.85', 'neutral_0', Channel, ['channel_1', {name: 'Channel 1 state'}], [DefaultParser]],  // @to4ko
                ['4.2.85', 'neutral_1', Channel, ['channel_2', {name: 'Channel 2 state'}], [DefaultParser]],  // @to4ko
                // ['13.1.85', undefined, 'button_1'],
                // ['13.2.85', undefined, 'button_2'],
                // ['13.5.85', undefined, 'button_both'],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            'lumi.switch.b2lacn02': ['Aqara', 'Double Wall Switch D1', 'QBKG22LM'],
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                ['4.1.85', 'channel_0', Channel, ['channel_1', {name: 'Channel 1 state'}], [DefaultParser]],
                ['4.2.85', 'channel_1', Channel, ['channel_2', {name: 'Channel 2 state'}], [DefaultParser]],
                // ['13.1.85', undefined, 'button_1'],
                // ['13.2.85', undefined, 'button_2'],
                // ['13.5.85', undefined, 'button_both'],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            // triple channel on/off, no neutral wire
            'lumi.switch.l3acn3': ['Aqara', 'Triple Wall Switch D1', 'QBKG25LM'],
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                ['4.1.85', 'neutral_0', Channel, ['channel_1', {name: 'Channel 1 state'}], [DefaultParser]],  // @to4ko
                ['4.2.85', 'neutral_1', Channel, ['channel_2', {name: 'Channel 2 state'}], [DefaultParser]],  // @to4ko
                ['4.3.85', 'neutral_2', Channel, ['channel_3', {name: 'Channel 3 state'}], [DefaultParser]],  // @to4ko
                // ['13.1.85', undefined, 'button_1'],
                // ['13.2.85', undefined, 'button_2'],
                // ['13.3.85', undefined, 'button_3'],
                // ['13.5.85', undefined, 'button_both_12'],
                // ['13.6.85', undefined, 'button_both_13'],
                // ['13.7.85', undefined, 'button_both_23'],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            // with neutral wire, thanks @Mantoui
            'lumi.switch.n3acn3': ['Aqara', 'Triple Wall Switch D1', 'QBKG26LM'],
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                ['0.12.85', 'load_power', LoadPower, [], [DefaultParser]],
                // ['0.13.85', undefined, 'consumption', 'sensor'],
                ['4.1.85', 'channel_0', Channel, ['channel_1', {name: 'Channel 1 state'}], [DefaultParser]],
                ['4.2.85', 'channel_1', Channel, ['channel_2', {name: 'Channel 2 state'}], [DefaultParser]],
                ['4.3.85', 'channel_2', Channel, ['channel_3', {name: 'Channel 3 state'}], [DefaultParser]],
                // ['13.1.85', undefined, 'button_1'],
                // ['13.2.85', undefined, 'button_2'],
                // ['13.3.85', undefined, 'button_3'],
                // ['13.5.85', undefined, 'button_both_12'],
                // ['13.6.85', undefined, 'button_both_13'],
                // ['13.7.85', undefined, 'button_both_23'],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            // cube action, no retain
            'lumi.sensor_cube': ['Aqara', 'Cube', 'MFKZQ01LM'],
            'lumi.sensor_cube.aqgl01': ['Aqara', 'Cube', 'MFKZQ01LM'],  // tested
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                // ['0.2.85', undefined, 'duration'],
                // ['0.3.85', undefined, 'angle'],
                ['8.0.2008', 'voltage', Voltage, [], [VoltageParser]],
                ['8.0.2008', 'voltage', Battery, [], [BatteryParser]],
                // ['13.1.85', undefined, 'action', 'sensor'],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
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
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                ['4.1.85', 'power_status', Switch, [], [SwitchParser]],
                ['14.1.85', 'light_level', Brightness, [], [DefaultParser]],
                ['14.2.85', 'colour_temperature', ColorTemperature, [], [DefaultParser]], // colour???
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            // light with brightness
            'ikea.light.led1623g12': ['IKEA', 'Bulb E27 1000 lm', 'LED1623G12'],
            'ikea.light.led1650r5': ['IKEA', 'Bulb GU10 400 lm', 'LED1650R5'],
            'ikea.light.led1649c5': ['IKEA', 'Bulb E14', 'LED1649C5'],  // tested
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                ['4.1.85', 'power_status', Switch, [], [SwitchParser]],
                ['14.1.85', 'light_level', Brightness, [], [DefaultParser]],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            'lumi.sensor_switch': ['Xiaomi', 'Button', 'WXKG01LM'],
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                ['13.1.85', undefined, Button, ['single_press', {name: 'Button single press'}], [Button1PressParser]],
                ['13.1.85', undefined, Button, ['double_press', {name: 'Button double press'}], [Button2PressParser]],
                ['13.1.85', undefined, Button, ['triple_press', {name: 'Button triple press'}], [Button3PressParser]],
                ['13.1.85', undefined, Button, ['quadruple_press', {name: 'Button quadruple press'}], [Button4PressParser]],
                ['13.1.85', undefined, Button, ['multiple_press', {name: 'Button multiple press'}], [ButtonMultiplePressParser]],
                ['13.1.85', undefined, Button, ['long_press', {name: 'Button long press'}, {valueMap: [[16, 17], [true, false]], dependsOn: ['long_timeout']}], [DefaultParser]],
                [undefined, undefined, Timeout, ['long_timeout', {name: 'Long press timeout'}]],
                ['8.0.2008', 'voltage', Voltage, [], [VoltageParser]],
                ['8.0.2008', 'voltage', Battery, [], [BatteryParser]],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            /*
             * For now WXKG11LM is separated from WXKG01LM because 
             * the triple, quadruple, hold and release is not supported by all versions of WXKG11LM.
             */
            'lumi.sensor_switch.aq2': ['Aqara', 'Button', 'WXKG11LM'],
            'lumi.remote.b1acn01': ['Aqara', 'Button', 'WXKG11LM'],
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                ['13.1.85', undefined, Button, ['single_press', {name: 'Button single press'}], [Button1PressParser]],
                ['13.1.85', undefined, Button, ['double_press', {name: 'Button double press'}], [Button2PressParser]],
                ['13.1.85', undefined, Button, ['triple_press', {name: 'Button triple press'}], [Button3PressParser]],
                ['8.0.2008', 'voltage', Voltage, [], [VoltageParser]],
                ['8.0.2008', 'voltage', Battery, [], [BatteryParser]],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            // TEST NEEDED
            'lumi.sensor_switch.aq3': ['Aqara', 'Shake Button', 'WXKG12LM'],
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                ['13.1.85', undefined, Button, ['single_press', {name: 'Button single press'}], [Button1PressParser]],
                ['13.1.85', undefined, Button, ['double_press', {name: 'Button double press'}], [Button2PressParser]],
                ['13.1.85', undefined, Button, ['long_press', {name: 'Button long press'}, {valueMap: [[16, 17], [true, false]], dependsOn: ['long_timeout']}], [DefaultParser]],
                [undefined, undefined, Timeout, ['long_timeout', {name: 'Long press timeout'}]],
                //TODO: shake. need info
                ['8.0.2008', 'voltage', Voltage, [], [VoltageParser]],
                ['8.0.2008', 'voltage', Battery, [], [BatteryParser]],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            // TEST NEEDED
            'lumi.sensor_86sw1': ['Aqara', 'Single Wall Button', 'WXKG03LM'],
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                ['13.1.85', undefined, Button, ['single_press', {name: 'Button single press'}], [Button1PressParser]],
                ['8.0.2008', 'voltage', Voltage, [], [VoltageParser]],
                ['8.0.2008', 'voltage', Battery, [], [BatteryParser]],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            // TEST NEEDED
            'lumi.remote.b186acn01': ['Aqara', 'Single Wall Button', 'WXKG03LM'],
            'lumi.remote.b186acn02': ['Aqara', 'Single Wall Button D1', 'WXKG06LM'],
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                ['13.1.85', undefined, Button, ['single_press', {name: 'Button single press'}], [Button1PressParser]],
                ['13.1.85', undefined, Button, ['double_press', {name: 'Button double press'}], [Button2PressParser]],
                ['13.1.85', undefined, Button, ['long_press', {name: 'Button long press'}, {valueMap: [[16, 17], [true, false]], dependsOn: ['long_timeout']}], [DefaultParser]],
                [undefined, undefined, Timeout, ['long_timeout', {name: 'Long press timeout'}]],
                ['8.0.2008', 'voltage', Voltage, [], [VoltageParser]],
                ['8.0.2008', 'voltage', Battery, [], [BatteryParser]],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
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
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                // ['13.1.85', undefined, 'button_1'],
                // ['13.2.85', undefined, 'button_2'],
                // ['13.3.85', undefined, 'button_3'],
                // ['13.4.85', undefined, 'button_4'],
                // ['13.6.85', undefined, 'button_5'],
                // ['13.7.85', undefined, 'button_6'],
                // ['13.5.85', undefined, 'button_both'],
                ['8.0.2008', 'voltage', Voltage, [], [VoltageParser]],
                ['8.0.2008', 'voltage', Battery, [], [BatteryParser]],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            // temperature and humidity sensor
            'lumi.sensor_ht': ['Xiaomi', 'TH Sensor', 'WSDCGQ01LM'],
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                ['0.1.85', 'temperature', Temperature, [], [TemperatureParser]],
                ['0.2.85', 'humidity', Humidity, [], [HumidityParser]],
                ['8.0.2008', 'voltage', Voltage, [], [VoltageParser]],
                ['8.0.2008', 'voltage', Battery, [], [BatteryParser]],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            // temperature, humidity and pressure sensor
            'lumi.weather': ['Aqara', 'TH Sensor', 'WSDCGQ11LM'],
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                ['0.1.85', 'temperature', Temperature, [], [TemperatureParser]],
                ['0.2.85', 'humidity', Humidity, [], [HumidityParser]],
                ['0.3.85', 'pressure', Pressure, [], [PressureParser]],
                ['8.0.2008', 'voltage', Voltage, [], [VoltageParser]],
                ['8.0.2008', 'voltage', Battery, [], [BatteryParser]],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            'lumi.sensor_ht.agl02': ['Aqara', 'TH Sensor', 'WSDCGQ12LM'],
            'spec': [
                ['2.1', '2.1', Temperature, [], [TemperatureParser]],
                ['2.2', '2.2', Humidity, [], [HumidityParser]],
                ['2.3', '2.3', Pressure, [], [PressureParser]],
                ['3.1', '3.1', Battery, [], [BatteryParser]],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            // door window sensor
            'lumi.sensor_magnet': ['Xiaomi', 'Door Sensor', 'MCCGQ01LM'],
            'lumi.sensor_magnet.aq2': ['Aqara', 'Door Sensor', 'MCCGQ11LM'],
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                ['3.1.85', 'status', Contact, [], [ContactParser]],
                ['8.0.2008', 'voltage', Voltage, [], [VoltageParser]],
                ['8.0.2008', 'voltage', Battery, [], [BatteryParser]],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            // motion sensor
            'lumi.sensor_motion': ['Xiaomi', 'Motion Sensor', 'RTCGQ01LM'],
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                ['3.1.85', undefined, Occupancy, [], [DefaultParser]],
                ['8.0.2008', 'voltage', Voltage, [], [VoltageParser]],
                ['8.0.2008', 'voltage', Battery, [], [BatteryParser]],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            // motion sensor with illuminance
            'lumi.sensor_motion.aq2': ['Aqara', 'Motion Sensor', 'RTCGQ11LM'],
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                // ['0.3.85', 'lux', 'illuminance_lux'],
                ['0.4.85', 'illumination', Illuminance, [], [DefaultParser]],
                ['3.1.85', undefined, Occupancy, [], [DefaultParser]],
                ['8.0.2008', 'voltage', Voltage, [], [VoltageParser]],
                ['8.0.2008', 'voltage', Battery, [], [BatteryParser]],
                [undefined, undefined, NoMotion, []], // number, seconds
                [undefined, undefined, Timeout, ['occupancy_timeout', {name: 'Occupancy timeout'}]],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            // water leak sensor
            'lumi.sensor_wleak.aq1': ['Aqara', 'Water Leak Sensor', 'SJCGQ11LM'],
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                ['3.1.85', 'alarm', Alarm, ['water_leak', {name: 'Water leak detected'}], [DefaultParser]], //moisture?
                ['8.0.2008', 'voltage', Voltage, [], [VoltageParser]],
                ['8.0.2008', 'voltage', Battery, [], [BatteryParser]],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            // vibration sensor
            'lumi.vibration.aq1': ['Aqara', 'Vibration Sensor', 'DJT11LM'],
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                // ['0.1.85', undefined, 'bed_activity'], // TODO:
                // ['0.2.85', undefined, 'tilt_angle'], // TODO:
                // ['0.3.85', undefined, 'vibrate_intensity'], // TODO:
                // ['13.1.85', undefined, 'vibration'], // TODO:
                // ['14.1.85', undefined, 'vibration_level'], // TODO:
                ['8.0.2008', 'voltage', Voltage, [], [VoltageParser]],
                ['8.0.2008', 'voltage', Battery, [], [BatteryParser]],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            'lumi.sen_ill.mgl01': ['Xiaomi', 'Light Sensor', 'GZCGQ01LM'],
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['2.1', '2.1', Illuminance, [], [DefaultParser]],
                ['3.1', '3.1', Battery, [], [BatteryParser]],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            'lumi.sensor_smoke': ['Honeywell', 'Smoke Sensor', 'JTYJ-GD-01LM/BW'],
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                // ['0.1.85', 'density', 'smoke density', 'sensor'], ??
                ['13.1.85', 'alarm', Alarm, ['smoke', {name: 'Smoke detected'}], [DefaultParser]], // smoke?
                ['8.0.2008', 'voltage', Voltage, [], [VoltageParser]],
                ['8.0.2008', 'voltage', Battery, [], [BatteryParser]],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            'lumi.sensor_natgas': ['Honeywell', 'Gas Sensor', 'JTQJ-BF-01LM/BW'],
            'spec': [
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                // ['0.1.85', 'density', 'gas density', 'sensor'], ??
                ['13.1.85', 'alarm', Alarm, ['gas', {name: 'Gas detected'}], [DefaultParser]], // gas?
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            'lumi.curtain': ['Aqara', 'Curtain', 'ZNCLDJ11LM'],
            'lumi.curtain.aq2': ['Aqara', 'Roller Shade', 'ZNGZDJ11LM'],
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                ['1.1.85', 'curtain_level', CurtainLevel, [], [DefaultParser]],
                ['14.2.85', undefined, CurtainMotor, [], [DefaultParser]], // {0: "close", 1: "open", 2: "stop"}
                // ['14.3.85', 'cfg_param', 'cfg_param'], // TODO: ??
                ['14.4.85', 'run_state', RunState, [], [DefaultParser]], // {0: "closing", 1: "opening", 2: "stop"}
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            'lumi.curtain.hagl04': ['Aqara', 'Curtain B1', 'ZNCLDJ12LM'],
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                ['1.1.85', 'curtain_level', CurtainLevel, [], [DefaultParser]],
                ['14.2.85', undefined, CurtainMotor, [], [DefaultParser]], // {0: "close", 1: "open", 2: "stop"}
                // ['14.3.85', 'cfg_param', 'cfg_param'], // TODO: ??
                ['14.4.85', 'run_state', RunState, [], [DefaultParser]], // {0: "closing", 1: "opening", 2: "stop"}
                ['8.0.2008', 'voltage', Voltage, [], [VoltageParser]],
                ['8.0.2008', 'voltage', Battery, [], [BatteryParser]],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            'lumi.lock.aq1': ['Aqara', 'Door Lock S1', 'ZNMS11LM'],
            'lumi.lock.acn02': ['Aqara', 'Door Lock S2', 'ZNMS12LM'],
            'lumi.lock.acn03': ['Aqara', 'Door Lock S2 Pro', 'ZNMS12LM'],
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                // ['13.1.85', undefined, 'key_id', 'sensor'],
                ['13.20.85', 'lock_state', LockState, [], [DefaultParser]],
                ['8.0.2008', 'voltage', Voltage, [], [VoltageParser]],
                ['8.0.2008', 'voltage', Battery, [], [BatteryParser]],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            // https://github.com/AlexxIT/XiaomiGateway3/issues/101
            'lumi.airrtc.tcpecn02': ['Aqara', 'Thermostat S2', 'KTWKQ03ES'],
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                // ['3.1.85', 'power_status', 'power'],
                // ['3.2.85', undefined, 'current_temperature'], // TODO:
                // ['14.2.85', 'ac_state', 'climate', 'climate'],
                // ['14.8.85', undefined, 'mode'], // TODO: ???
                // ['14.9.85', undefined, 'target_temperature'], // TODO:
                // ['14.10.85', undefined, 'fan_mode'], // TODO: ???
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            'lumi.airrtc.vrfegl01': ['Xiaomi', 'VRF Air Conditioning'],
            'spec': [
                [undefined, 'alive', Available, [], [AvailableParser]],
                ['8.0.2007', 'lqi', LinkQuality, [], [DefaultParser]],
                // ['13.1.85', undefined, 'channels', 'sensor'],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            // no N, https://www.aqara.com/en/single_switch_T1_no-neutral.html
            'lumi.switch.l0agl1': ['Aqara', 'Relay T1', 'SSM-U02'],
            'spec': [
                ['2.1', '2.1', Switch, [], [SwitchParser]],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            // with N, https://www.aqara.com/en/single_switch_T1_with-neutral.html
            'lumi.switch.n0agl1': ['Aqara', 'Relay T1', 'SSM-U01'],
            'lumi.plug.maeu01': ['Aqara', 'Plug', 'SP-EUC01'],
            'spec': [
                ['2.1', '2.1', Switch, [], [SwitchParser]],
                // ['3.1', '3.1', 'consumption', 'sensor'],
                ['3.2', '3.2', LoadPower, [], [DefaultParser]],
                // ['5.7', '5.7', 'voltage', 'sensor'],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        // {
        //     'lumi.motion.agl04': ['Aqara', 'Precision Motion Sensor', 'RTCGQ13LM'],
        //     'mi_spec': [
        //         [undefined, undefined, Occupancy, []],
        //         ['3.1', '3.1', Battery, [], [BatteryParser]],
        //         ['4.1', undefined, 'motion: 1'],
        //     ]
        // },
        {
            'lumi.airmonitor.acn01': ['Aqara', 'TVOC Air Quality Monitor', 'VOCKQJK11LM'],
            'spec': [
                ['3.1', '3.1', Temperature, [], [TemperatureParser]],
                ['3.2', '3.2', Humidity, [], [HumidityParser]],
                // ['3.3', '3.3', 'tvoc', 'sensor'],
                ['4.1', '4.1', Alarm, [], [DefaultParser]], //tvoc_level
                ['4.2', '4.2', Battery, [], [BatteryParser]],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            'lumi.switch.b1lc04': ['Aqara', 'Single Wall Switch E1', 'QBKG38LM'],
            'spec': [
                ['2.1', '2.1', Switch, [], [SwitchParser]],
                // ['6.1', undefined, 'button: 1'],
                // ['6.2', undefined, 'button: 2'],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        },
        {
            'lumi.switch.b2lc04': ['Aqara', 'Double Wall Switch E1', 'QBKG39LM'],
            'spec': [
                ['2.1', '2.1', Channel, ['channel_1', {name: 'Channel 1 state'}], [DefaultParser]],
                ['3.1', '3.1', Channel, ['channel_2', {name: 'Channel 2 state'}], [DefaultParser]],
                // ['7.1', undefined, 'button_1: 1'],
                // ['7.2', undefined, 'button_1: 2'],
                // ['8.1', undefined, 'button_2: 1'],
                // ['8.2', undefined, 'button_2: 2'],
                // ['9.1', undefined, 'button_both: 4'],
                [undefined, undefined, DebugOutput, [], [DebugOutputParser]],
                [undefined, undefined, MessagesStat, [], [MessagesStatParser]],
            ]
        }
    ];

    static getDevice(model, extDevices) {
        if (String(model).match(RE_ZIGBEE_MODEL_TAIL) != undefined)
            model = model.substr(0, model.length-3);

        /* I do concatenation internal and external definitions of devices */
        // TODO: external devices definitions
        const device = [].concat(this.#DEVICES, isArray(extDevices) ? extDevices : [])
            .find(el => Object.keys(el).includes(model));

        if (device != undefined) {
            const deviceSpec = (device['spec'] || []).map(spec => {
                const [lumi, prop, stateClass, [...stateArgs], stateParsers] = spec;
                const parsersFuncs = (stateParsers || [function() {return val => undefined}]).map(f => f(model));

                /* define new class which extends state class with zigbee devices specific functionality */
                const LumiStateClass = class extends stateClass {
                    /* Override */
                    normalizeLeft(val) {
                        const parsersChainFunc = funcs => val => funcs.reduce((p, pf) => pf(p, true), val);
                        return super.normalizeLeft(parsersChainFunc(parsersFuncs)(val));
                    }

                    /* Override */
                    normalizeRight(val) {
                        return super.normalizeRight(val);
                    }

                    decode(/* [[lumi, val]] */keyVal) {
                        let payload;

                        if (this.resource != undefined && isArray(keyVal)) {
                            payload = keyVal
                                .filter(spec => spec[0] == this.resource)
                                .reduce((pv, [, val]) => Object.assign({}, pv, {[this.stateName]: this.normalizeLeft(val)}), {});
                        } else {
                            payload = {[this.stateName]: this.normalizeLeft(keyVal)};
                        }

                        Object.keys(payload).forEach(key => payload[key] === undefined ? delete payload[key] : {});

                        return payload;
                    }

                    encode(val) {
                        const lumiPropRe = /^(\d+.){2}\d+$/gm;
                        const miotPropRe = /^\d+.\d+$/gm;

                        const value = this.normalizeRight(val);

                        if (RegExp(lumiPropRe).test(this.resource)) {
                            return {'params': [{'res_name': this.resource, value}]};
                        } else if (RegExp(miotPropRe).test(this.resource)) {
                            const [siid, piid] = prop.split('.').slice(0, 1);
                            return {'mi_spec': [{siid, piid, value}]};
                        } else {
                            return undefined;
                        }
                    }

                    /* */
                    constructor(resource, ...stateArgs) {
                        super(...stateArgs);
                        this.resource = resource;
                    }
                };

                /* return device specification array */
                return [
                    lumi,
                    prop,
                    new LumiStateClass(lumi, ...stateArgs)
                ];
            });
            
            let desc = device[model];

            return {
                'manufacturer': `${desc[0]}`,
                'name': `${desc[0]} ${desc[1]}`,
                'model': `${desc.length > 2 ? desc[2] : model}`,
                'spec': deviceSpec
            };
        } else {
            return {
                'name': `Zigbee`,
                'model': model,
                'spec': []
            };
        }
    }
};

/* Default parser function */
function DefaultParser() {
    return val => val;
}

/* Special parsers functions */
function DebugOutputParser(model) {
    return val => {
        if (isArray(val)) {
            return JSON.stringify({
                'model': model,
                'lumi': (val || []).map(([prop]) => prop)
            });
        } else {
            return undefined;
        }
    };
}

function MessagesStatParser() {
    return val => {
        if (isObject(val) == true && Object.getOwnPropertyNames(val).includes('nwk'))
            return JSON.stringify(val);
        else
            return undefined;
    };
}

/* Parsers functions */
function AvailableParser() {
    return val => 1;
}

function BatteryParser(model) {
    return val => {
        if (val != undefined) {
            if (val <= 100)
                return val;
            else if (val <= 2700)
                return 0;
            else if (val >= 3200)
                return 100;
            else                    
                return Math.round((val - 2700) / 5);
        } else {
            return undefined;
        }
    };
}

/**
 * Button parsers
 * https://github.com/AlexxIT/XiaomiGateway3/blob/converters/custom_components/xiaomi_gateway3/core/converters/const.py#L19
 * https://github.com/Koenkk/zigbee-herdsman-converters/blob/master/converters/fromZigbee.js#L4738
 * 
 * BUTTON = {
 *     1: SINGLE,
 *     2: DOUBLE,
 *     3: TRIPLE,
 *     4: QUADRUPLE,
 *     5: "quintuple",  # only Yeelight Dimmer
 *     16: HOLD,
 *     17: RELEASE,
 *     18: "shake",
 *     128: "many",
 * }
 * BUTTON_BOTH = {
 *     4: SINGLE,
 *     5: DOUBLE,
 *     6: TRIPLE,
 *     16: HOLD,
 *     17: RELEASE,
 * }
 */
function Button1PressParser(model) {
    return val => val == 1 ? 1 : 0;
}

function Button2PressParser(model) {
    return val => val == 2 ? 1 : 0;
}

function Button3PressParser(model) {
    return val => val == 3 ? 1 : 0;
}

function Button4PressParser(model) {
    return val => val == 4 ? 1 : 0;
}

function ButtonMultiplePressParser(model) {
    return val => val == 128 ? 1 : 0;
}

/* */
function ConsumptionParser(model) {
    return val => {
        if (typeof val === 'number')
            return val.toFixed(2);
        else
            return parseFloat(val).toFixed(2);
    };
}

function ContactParser(model) {
    return val => {
        const returnValue = [0, 1][['close', 'open'].indexOf(val)];
        return returnValue != undefined ? returnValue : val;
    };
}

function HumidityParser(model) {
    if (['lumi.airmonitor.acn01', 'lumi.sensor_ht.agl02'].includes(model) == false)
        return val => Math.round(val / 100);
    else
        return val => val;
}

function PowerParser(model) {
    return val => {
        if (typeof val === 'number')
            return val.toFixed(2);
        else
            return parseFloat(val).toFixed(2);
    };
}

function PressureParser(model) {
    if (['lumi.airmonitor.acn01', 'lumi.sensor_ht.agl02'].includes(model) == false)
        return val => val / 100;
    else
        return val => val;
}

function RunStateParser(model) {
    return val => {
        // # https://github.com/AlexxIT/XiaomiGateway3/issues/139
        if (val == 'offing')
            return 0;
        else if (val == 'oning')
            return 1;
        else
            return 2;
    };
}

function SwitchParser(model) {
    return val => ([1, 0][['on', 'off'].indexOf(val)] || val);
}

function TemperatureParser(model) {
    if (['lumi.airmonitor.acn01', 'lumi.sensor_ht.agl02'].includes(model) == false)
        return val => Math.round(val / 100);
    else
        return val => val;
}

function VoltageParser(model) {
    return val => Number(Number(val / 1000).toFixed(3));
}

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

// static #CLUSTERS = {
//     0x0000: 'Basic',
//     0x0001: 'PowerCfg',
//     0x0003: 'Identify',
//     0x0006: 'OnOff',
//     0x0008: 'LevelCtrl',
//     0x000A: 'Time',
//     0x000C: 'AnalogInput',  # cube, gas sensor
//     0x0012: 'Multistate',
//     0x0019: 'OTA',  # illuminance sensor
//     0x0101: 'DoorLock',
//     0x0400: 'Illuminance',  # motion sensor
//     0x0402: 'Temperature',
//     0x0403: 'Pressure',
//     0x0405: 'Humidity',
//     0x0406: 'Occupancy',  # motion sensor
//     0x0500: 'IasZone',  # gas sensor
//     0x0B04: 'ElectrMeasur',
//     0xFCC0: 'Xiaomi'
// };