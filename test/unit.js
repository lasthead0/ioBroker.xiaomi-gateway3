const path = require('path');
const {tests} = require('@iobroker/testing');
const {expect} = require('chai');

// Run unit tests - See https://github.com/ioBroker/testing for a detailed explanation and further options
tests.unit(path.join(__dirname, '..'), {
    defineAdditionalTests() {
        describe('parseXiaomiBle', () => {
            const Bluetooth = require('../lib/bluetooth');

            it('eid == 0x1003 //4099', () => {
                const parsed = Bluetooth.parseXiaomiBle({eid: 0x1003, edata: 'ff', pdid: 0})
                    .map(el => [el[0].stateName, el[1]]);

                expect(parsed.filter(el => ['debug_output'].includes(el[0]) == false)).to.deep
                    .equals([['link_quality', 255]]);
            });

            it('eid == 0x1004 //4100', () => {
                const parsed = Bluetooth.parseXiaomiBle({eid: 0x1004, edata: '2701', pdid: 0})
                    .map(el => [el[0].stateName, el[1]]);

                expect(parsed.filter(el => ['debug_output'].includes(el[0]) == false)).to.deep
                    .equals([['temperature', 29.5]]);
            });

            it('eid == 0x1005 //4101', () => {
                const parsed = Bluetooth.parseXiaomiBle({eid: 0x1005, edata: '0150', pdid: 0})
                    .map(el => [el[0].stateName, el[1]]);

                expect(parsed.filter(el => ['debug_output'].includes(el[0]) == false)).to.deep
                    .equals([['power', true], ['temperature', 80]]);
            });

            it('eid == 0x1006 //4102', () => {
                const parsed = Bluetooth.parseXiaomiBle({eid: 0x1006, edata: '7601', pdid: 0})
                    .map(el => [el[0].stateName, el[1]]);

                expect(parsed.filter(el => ['debug_output'].includes(el[0]) == false)).to.deep
                    .equals([['humidity', 37.4]]);
            });

            it('eid == 0x1007 //4103', () => {
                const parsed = Bluetooth.parseXiaomiBle({eid: 0x1007, edata: 'a08601', pdid: 0})
                    .map(el => [el[0].stateName, el[1]]);

                expect(parsed.filter(el => ['debug_output'].includes(el[0]) == false)).to.deep
                    .equals([['illuminance', 100000]]);
            });

            it('eid == 0x1007 //4103 //pdid == 2038', () => {
                const parsed = Bluetooth.parseXiaomiBle({eid: 0x1007, edata: 'a08601', pdid: 2038})
                    .map(el => [el[0].stateName, el[1]]);

                expect(parsed.filter(el => ['debug_output'].includes(el[0]) == false)).to.deep
                    .equals([['light', true]]);
            });

            it('eid == 0x1008 //4104', () => {
                const parsed = Bluetooth.parseXiaomiBle({eid: 0x1008, edata: '63', pdid: 0})
                    .map(el => [el[0].stateName, el[1]]);

                expect(parsed.filter(el => ['debug_output'].includes(el[0]) == false)).to.deep
                    .equals([['moisture', 99]]);
            });

            it('eid == 0x1009 //4105', () => {
                const parsed = Bluetooth.parseXiaomiBle({eid: 0x1009, edata: 'fd08', pdid: 0})
                    .map(el => [el[0].stateName, el[1]]);

                expect(parsed.filter(el => ['debug_output'].includes(el[0]) == false)).to.deep
                    .equals([['conductivity', 2301]]);
            });

            it('eid == 0x100A //4106', () => {
                const parsed = Bluetooth.parseXiaomiBle({eid: 0x100A, edata: '64', pdid: 1371})
                    .map(el => [el[0].stateName, el[1]]);

                expect(parsed.filter(el => ['debug_output'].includes(el[0]) == false)).to.deep
                    .equals([['battery', 100]]);
            });

            it('eid == 0x100D //4109', () => {
                const parsed = Bluetooth.parseXiaomiBle({eid: 0x100D, edata: '27017601', pdid: 0})
                    .map(el => [el[0].stateName, el[1]]);

                expect(parsed.filter(el => ['debug_output'].includes(el[0]) == false)).to.deep
                    .equals([['temperature', 29.5], ['humidity', 37.4]]);
            });

            it('eid == 0x1010 //4112', () => {
                const parsed = Bluetooth.parseXiaomiBle({eid: 0x1010, edata: '0900', pdid: 0})
                    .map(el => [el[0].stateName, el[1]]);

                expect(parsed.filter(el => ['debug_output'].includes(el[0]) == false)).to.deep
                    .equals([['formaldehyde', 0.09]]);
            });

            it('eid == 0x1013 //4115', () => {
                const parsed = Bluetooth.parseXiaomiBle({eid: 0x1013, edata: '63', pdid: 0})
                    .map(el => [el[0].stateName, el[1]]);

                expect(parsed.filter(el => ['debug_output'].includes(el[0]) == false)).to.deep
                    .equals([['remaining', 99]]);
            });

            it('eid == 0x1014 //4116', () => {
                const parsed = Bluetooth.parseXiaomiBle({eid: 0x1014, edata: '01', pdid: 0})
                    .map(el => [el[0].stateName, el[1]]);

                expect(parsed.filter(el => ['debug_output'].includes(el[0]) == false)).to.deep
                    .equals([['water_leak', true]]);
            });

            it('eid == 0x1015 //4117', () => {
                const parsed = Bluetooth.parseXiaomiBle({eid: 0x1015, edata: '01', pdid: 0})
                    .map(el => [el[0].stateName, el[1]]);

                expect(parsed.filter(el => ['debug_output'].includes(el[0]) == false)).to.deep
                    .equals([['smoke', true]]);
            });

            it('eid == 0x1016 //4118', () => {
                const parsed = Bluetooth.parseXiaomiBle({eid: 0x1016, edata: '01', pdid: 0})
                    .map(el => [el[0].stateName, el[1]]);

                expect(parsed.filter(el => ['debug_output'].includes(el[0]) == false)).to.deep
                    .equals([['gas', true]]);
            });

            it('eid == 0x1017 //4119', () => {
                const parsed = Bluetooth.parseXiaomiBle({eid: 0x1017, edata: '00010000', pdid: 0})
                    .map(el => [el[0].stateName, el[1]]);

                expect(parsed.filter(el => ['debug_output'].includes(el[0]) == false)).to.deep
                    .equals([['idle_time', 256]]);
            });

            it('eid == 0x1018 //4120', () => {
                const parsed = Bluetooth.parseXiaomiBle({eid: 0x1018, edata: '01', pdid: 0})
                    .map(el => [el[0].stateName, el[1]]);

                expect(parsed.filter(el => ['debug_output'].includes(el[0]) == false)).to.deep
                    .equals([['light', true]]);
            });

            it('eid == 0x1019 //4121', () => {
                const parsed = Bluetooth.parseXiaomiBle({eid: 0x1019, edata: '01', pdid: 0})
                    .map(el => [el[0].stateName, el[1]]);

                expect(parsed.filter(el => ['debug_output'].includes(el[0]) == false)).to.deep
                    .equals([['contact', true]]);
            });

            it('eid == 0x0F   //15', () => {
                const parsed = Bluetooth.parseXiaomiBle({eid: 0x0F, edata: 'a08601', pdid: 0})
                    .map(el => [el[0].stateName, el[1]]);

                expect(parsed.filter(el => ['debug_output'].includes(el[0]) == false)).to.deep
                    .equals([['occupancy', true], ['light', true]]);
            });

            it('eid == 0x0F   //15   //pdid == 2691', () => {
                const parsed = Bluetooth.parseXiaomiBle({eid: 0x0F, edata: 'a08601', pdid: 2691})
                    .map(el => [el[0].stateName, el[1]]);

                expect(parsed.filter(el => ['debug_output'].includes(el[0]) == false)).to.deep
                    .equals([['occupancy', true], ['illuminance', 100000]]);
            });
        });

        describe('State class test', () => {
            const {Alarm} = require('../lib/stateClass');
            const alarm = new Alarm({valueMap: [[0, 1], [true, false]]});

            it('_normalizeLeft', () => {
                expect(alarm.normalizeLeft(0)).to.deep
                    .equals(true);
            });

            it('_normalizeRight', () => {
                expect(alarm.normalizeRight(false)).to.deep
                    .equals(1);
            });
        });
    }
});
