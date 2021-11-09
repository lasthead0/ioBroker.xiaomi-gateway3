const path = require('path');
const {tests} = require('@iobroker/testing');
const {expect} = require('chai');

// Run unit tests - See https://github.com/ioBroker/testing for a detailed explanation and further options
tests.unit(path.join(__dirname, '..'), {
    defineAdditionalTests() {
        describe('parseXiaomiBle', () => {
            const Bluetooth = require('../lib/bluetooth');

            it('eid == 0x1003 //4099', () => {
                expect(Bluetooth.parseXiaomiBle({eid: 0x1003, edata: 'ff', pdid: 0})).to.deep
                    .equals({'link_quality': 255});
            });

            it('eid == 0x1004 //4100', () => {
                expect(Bluetooth.parseXiaomiBle({eid: 0x1004, edata: '2701', pdid: 0})).to.deep
                    .equals({'temperature': 29.5});
            });

            it('eid == 0x1005 //4101', () => {
                expect(Bluetooth.parseXiaomiBle({eid: 0x1005, edata: '0150', pdid: 0})).to.deep
                    .equals({'power': 1, 'temperature': 80});
            });

            it('eid == 0x1006 //4102', () => {
                expect(Bluetooth.parseXiaomiBle({eid: 0x1006, edata: '7601', pdid: 0})).to.deep
                    .equals({'humidity': 37.4});
            });

            it('eid == 0x1007 //4103', () => {
                expect(Bluetooth.parseXiaomiBle({eid: 0x1007, edata: 'a08601', pdid: 0})).to.deep
                    .equals({'illuminance': 100000});
            });

            it('eid == 0x1007 //4103 //pdid == 2038', () => {
                expect(Bluetooth.parseXiaomiBle({eid: 0x1007, edata: 'a08601', pdid: 2038})).to.deep
                    .equals({'light': 1});
            });

            it('eid == 0x1008 //4104', () => {
                expect(Bluetooth.parseXiaomiBle({eid: 0x1008, edata: '63', pdid: 0})).to.deep
                    .equals({'moisture': 99});
            });

            it('eid == 0x1009 //4105', () => {
                expect(Bluetooth.parseXiaomiBle({eid: 0x1009, edata: 'fd08', pdid: 0})).to.deep
                    .equals({'conductivity': 2301});
            });

            it('eid == 0x100A //4106', () => {
                expect(Bluetooth.parseXiaomiBle({eid: 0x100A, edata: '64', pdid: 1371})).to.deep
                    .equals({'battery': 100});
            });

            it('eid == 0x100D //4109', () => {
                expect(Bluetooth.parseXiaomiBle({eid: 0x100D, edata: '27017601', pdid: 0})).to.deep
                    .equals({'temperature': 29.5, 'humidity': 37.4});
            });

            it('eid == 0x1010 //4112', () => {
                expect(Bluetooth.parseXiaomiBle({eid: 0x1010, edata: '0900', pdid: 0})).to.deep
                    .equals({'formaldehyde': 0.09});
            });

            it('eid == 0x1013 //4115', () => {
                expect(Bluetooth.parseXiaomiBle({eid: 0x1013, edata: '63', pdid: 0})).to.deep
                    .equals({'remaining': 99});
            });

            it('eid == 0x1014 //4116', () => {
                expect(Bluetooth.parseXiaomiBle({eid: 0x1014, edata: '01', pdid: 0})).to.deep
                    .equals({'water_leak': 1});
            });

            it('eid == 0x1015 //4117', () => {
                expect(Bluetooth.parseXiaomiBle({eid: 0x1015, edata: '01', pdid: 0})).to.deep
                    .equals({'smoke': 1});
            });

            it('eid == 0x1016 //4118', () => {
                expect(Bluetooth.parseXiaomiBle({eid: 0x1016, edata: '01', pdid: 0})).to.deep
                    .equals({'gas': 1});
            });

            it('eid == 0x1017 //4119', () => {
                expect(Bluetooth.parseXiaomiBle({eid: 0x1017, edata: '00010000', pdid: 0})).to.deep
                    .equals({'idle_time': 256});
            });

            it('eid == 0x1018 //4120', () => {
                expect(Bluetooth.parseXiaomiBle({eid: 0x1018, edata: '01', pdid: 0})).to.deep
                    .equals({'light': 1});
            });

            it('eid == 0x1019 //4121', () => {
                expect(Bluetooth.parseXiaomiBle({eid: 0x1019, edata: '01', pdid: 0})).to.deep
                    .equals({'contact': 0});
            });

            it('eid == 0x0F   //15', () => {
                expect(Bluetooth.parseXiaomiBle({eid: 0x0F, edata: 'a08601', pdid: 0})).to.deep
                    .equals({'occupancy': 1, 'light': 1});
            });

            it('eid == 0x0F   //15   //pdid == 2691', () => {
                expect(Bluetooth.parseXiaomiBle({eid: 0x0F, edata: 'a08601', pdid: 2691})).to.deep
                    .equals({'occupancy': 1, 'illuminance': 100000});
            });
        });
    }
});
