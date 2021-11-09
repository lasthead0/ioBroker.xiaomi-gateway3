/* 
I rewrote code from https://github.com/AlexxIT/XiaomiGateway3 to JavaScript and NodeJS

The base logic was taken from project https://github.com/squachen/micloud

MIT License

Copyright (c) 2020 Sammy Svensson

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
*/

const crypto = require('crypto');
const axios = require('axios');

const UA = id => `Android-7.1.1-1.0.0-ONEPLUS A3010-136-${id} APP/xiaomi.smarthome APPV/62830`;

module.exports = class XiaomiCloud {
    /* {error, debug} */
    #_LOGGER = {
        'error': () => {},
        'debug': () => {}
    };

    #auth = undefined;

    constructor() {
        this.deviceId = crypto.randomBytes(8).toString('hex');
    }

    set logger(l) {this.#_LOGGER = l};
    get logger() {return this.#_LOGGER};

    /* */
    async login(username, password) {
        try {
            const payload = await this._loginStep1();

            if (payload == undefined)
                return false;

            const d = await this._loginStep2(username, password, payload);

            if (d == undefined || d.location == undefined || d.location == '')
                return false;

            const token = await this._loginStep3(d.location);

            if (token == undefined)
                return false;

            this.#auth = {
                'user_id': d['userId'],
                'ssecurity': d['ssecurity'],
                'service_token': token
            };

            return true;
        } catch (error) {
            this.logger.error(error);

            return false;
        }
    }

    /* */
    async getDevices(server) {
        const payload = {'getVirtualModel': false, 'getHuamiDevices': 0};

        const rr = await this._request(server, '/home/device_list', payload);
        
        if (rr != undefined && rr.message === 'ok')
            return rr.result.list;
        else
            return undefined;
    }

    /* */
    async _loginStep1() {
        try {
            const r = await axios.get('https://account.xiaomi.com/pass/serviceLogin?sid=xiaomiio&_json=true', {
                timeout: 5000,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'User-Agent': UA(this.deviceId),
                    'Cookie': `sdkVersion=3.8.6; deviceId=${this.deviceId}`
                }
            });
            const d = r.data;

            this.logger.debug(JSON.stringify(d));
            const obj = JSON.parse(String(d).substr(11));

            return (({sid, qs, callback, _sign}) => ({sid, qs, callback, _sign}))(obj);
        } catch (error) {
            this.logger.error(error);

            return undefined;
        }
    }

    /* */
    async _loginStep2(user, password, payload) {
        payload['user'] = user;
        payload['hash'] = crypto.createHash('md5').update(password).digest('hex').toUpperCase();
        payload['_json'] = true;
      
        try {
            const r = await axios.post('https://account.xiaomi.com/pass/serviceLoginAuth2', payload, {
                timeout: 5000,
                headers: {
                    // 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    // 'Content-Length': Buffer.byteLength(p, 'utf8'),
                    'User-Agent': UA(this.deviceId),
                    'Cookie': `sdkVersion=3.8.6; deviceId=${this.deviceId}`
                },
                transformRequest: data => Object.keys(data)
                    .reduce((pr, cr) => [...pr, `${encodeURIComponent(cr)}=${encodeURIComponent(payload[cr])}`], [])
                    .join('&')
            });
            const d = r.data;

            this.logger.debug(JSON.stringify(d));
            const obj = JSON.parse(String(d).substr(11));

            return obj;
        } catch (error) {
            this.logger.error(error);

            return undefined;
        }
    }

    /* Login step 3 (get serviceToken) */
    async _loginStep3(location) {
        try {
            const r = await axios.get(location, {
                timeout: 5000,
                headers: {
                    'User-Agent': UA(this.deviceId)
                }
            });
            
            const cookies = r.headers['set-cookie'].join('; ');
            const token = cookies.match(/serviceToken=.*?;\s{1}/g)[0].replace('; ', '').substr(13);

            return token;
        } catch (error) {
            this.logger.error(error);

            return undefined;
        }
    }

    /* */
    async _request(server, url, payload) {
        const baseurl = server == 'cn' ? `https://api.io.mi.com/app` : `https://${server}.api.io.mi.com/app`;

        const nonce = this._genNonce();
        const signature = this._genSignature(url, nonce, payload);

        const d = {
            'signature': signature,
            '_nonce': nonce,
            'data': JSON.stringify(payload)
        };

        const p = Object.keys(d).reduce((pr, cr) => [...pr, `${cr}=${d[cr]}`], []).join('&');

        try {
            const r = await axios.post([baseurl, url].join(''), p, {
                timeout: 5000,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    // 'Content-Length': Buffer.byteLength(p, 'utf8'),
                    'User-Agent': UA(this.deviceId),
                    'Cookie': `userId=${this.#auth['user_id']}; serviceToken=${this.#auth['service_token']}; yetAnotherServiceToken=${this.#auth['service_token']}; locale=en_US; timezone=GMT%2B01%3A00; is_daylight=1; dst_offset=3600000; channel=MI_APP_STORE`,
                    'x-xiaomi-protocal-flag-cli': 'PROTOCAL-HTTP2'
                }
            });
            const d = r.data;

            this.logger.debug(JSON.stringify(d));

            return d;
        } catch (error) {
            this.logger.error(error);

            return undefined;
        }
    }

    /* */
    _genNonce() {
        // let nonce = crypto.randomBytes(16);
        // nonce.writeInt32LE(new Date().getTime() / 60000);
        // nonce = nonce.toString('base64');
        let millis = Buffer.allocUnsafe(4);

        millis.writeUInt32BE(Math.round(new Date().getTime() / 60000));

        return Buffer.concat([
            Buffer.from(crypto.randomBytes(8)),
            millis
        ]).toString('base64');
    }

    /* */
    _genSignature(url, nonce, payload) {
        const signed_nonce = crypto.createHash('sha256').update(Buffer.concat([
            Buffer.from(this.#auth['ssecurity'], 'base64'),
            Buffer.from(nonce, 'base64')
        ])).digest('base64');

        const d = [url, signed_nonce, nonce, 'data=' + JSON.stringify(payload)].join('&');

        return crypto.createHmac('sha256', Buffer.from(signed_nonce, 'base64')).update(d).digest('base64');
    }
};
