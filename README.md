![Logo](admin/xiaomi-gateway3.png)
# ioBroker.xiaomi-gateway3

[![NPM version](https://img.shields.io/npm/v/iobroker.xiaomi-gateway3.svg)](https://www.npmjs.com/package/iobroker.xiaomi-gateway3)
[![Downloads](https://img.shields.io/npm/dm/iobroker.xiaomi-gateway3.svg)](https://www.npmjs.com/package/iobroker.xiaomi-gateway3)
![Number of Installations (latest)](https://iobroker.live/badges/xiaomi-gateway3-installed.svg)
![Number of Installations (stable)](https://iobroker.live/badges/xiaomi-gateway3-stable.svg)
[![Dependency Status](https://img.shields.io/david/lasthead0/iobroker.xiaomi-gateway3.svg)](https://david-dm.org/lasthead0/iobroker.xiaomi-gateway3)

![Test and Release](https://github.com/lasthead0/ioBroker.xiaomi-gateway3/workflows/Test%20and%20Release/badge.svg)

<!-- [![NPM](https://nodei.co/npm/iobroker.xiaomi-gateway3.png?downloads=true)](https://nodei.co/npm/iobroker.xiaomi-gateway3/) -->

## Xiaomi-gateway3 ioBroker adapter

This adapter allow ioBroker to communicate with Xiaomi Gateway 3 and use it to control Xiaomi devices.
Adapter communicates with gateway over MQTT protocol (it connects to build-in MQTT broker). However you have to pair your gateway and devices by Mi Home (Cloud).

## Early version

Adapter is in development stage, for now. But already has ready to go functionality.

For successful adapter development it needs community help mostly in tests adapter and devices.

## Thanks
Big part of code is based on and rewrote from [AlexxIT](https://github.com/AlexxIT) project [XiaomiGateway3](https://github.com/AlexxIT/XiaomiGateway3)

## Hardware and limits

<img src="static/xiaomi-gateway3-img.png" width="250">

Adapter supports `Xiaomi Gateway 3 (ZNDMWG03LM and ZNDMWG02LM)` running on original firmware these versions:
- `v1.5.0_0026` (developed on it)
- `v1.5.0_0102` (similar to `1.5.0_0026`, but not tested)

You can flash gateway with custom or stock firmware these versions: [wiki](https://github.com/AlexxIT/XiaomiGateway3/wiki).

__*!!Attantion:*__ Firmware versions lower than `1.4.7_0000` adapter not support and will not. Support of versions lower than `v1.5.0_0026` not guaranteed.

## Configuration

To connect a gateway you need get IP and TOKEN of gateway. You can do this manually or from cloud.

__*!!Attantion: There is issue with getting devices from cloud. I didn't get yet is this issue in code or with cloud, however you should try to get (to press button) devices several times, for now.*__

Also you have to chose telnet open command (in most cases option #2). You can test connection and telnet by buttons.

*Ping here not actually ping. It is more check of device availability.*

<img src="static/configuration-main.png">

<br/>

You have several options to configure adapter and gatewey.

<img src="static/configuration-settings.png">


### Basic Gateway3 settings
- [x] __Telnet enabled__<br/>
Enabled by default and have to stay enabled. Here just for info.

- [x] __Public MQTT enabled__<br/>
Enabled by default and have to stay enabled. Here just for info.

- [x] __Lock firmware__<br/>
Set true (or false) to disable (or enable) possibility to upgrade gateway firmware.

- [x] __Disable buzzer__<br/>
Set true to disable annoying buzzer signals or false to enable all signals.

### Advanced Gateway3 settings

- [x] __Storage in memory (Beta)__ <br/>
Move devices DB files to memory. This can improve work zigbee and bluetooth devices. __*But can occur losing some data. Use on your own risk.*__

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->
### 0.0.1-alpha.0 (2021-10-13)
* (Evgenii Abramov) Initial release

## License
MIT License

Copyright (c) 2021 Evgenii Abramov <john.abramov@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.