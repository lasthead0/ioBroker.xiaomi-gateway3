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

            it('eid == 0x100A //4106', () => {
                expect(Bluetooth.parseXiaomiBle({eid: 0x100A, edata: '64', pdid: 1371})).to.deep
                    .equals({'battery': 100});
            });

            it('eid == 0x100D //4109', () => {
                expect(Bluetooth.parseXiaomiBle({eid: 0x100D, edata: '27017601', pdid: 0})).to.deep
                    .equals({'temperature': 29.5, 'humidity': 37.4});
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
