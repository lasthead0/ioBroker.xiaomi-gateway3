/*
 * I rewrote code from https://github.com/AlexxIT/XiaomiGateway3 to JavaScript and NodeJS
 *
 * The base logic was taken from project https://github.com/squachen/micloud
 *
 * MIT License
 *
 * Copyright (c) 2020 Sammy Svensson
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
*/

const crypto = require('crypto');
const axios = require('axios');

const UA = id => `Android-7.1.1-1.0.0-ONEPLUS A3010-136-${id} APP/xiaomi.smarthome APPV/62830`;

const RC4 = true; // const for now

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
            const payload = await this._loginStep1(username);

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
            this.logger.error(error.stack);

            return false;
        }
    }

    /* */
    async _loginStep1(username) {
        try {
            const res = await axios.get('https://account.xiaomi.com/pass/serviceLogin?sid=xiaomiio&_json=true', {
                timeout: 5000,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'User-Agent': UA(this.deviceId),
                    // 'Cookie': `sdkVersion=3.8.6; deviceId=${this.deviceId}`
                    'Cookie': `sdkVersion=accountsdk-18.8.15; userId=${username}; deviceId=${this.deviceId}`
                }
            });
            const resData = res.data;

            this.logger.debug(`Login step #1: ${JSON.stringify(resData)}`);

            const obj = _replaceSTART(resData);
            const {sid, qs, callback, _sign} = obj;

            return {sid, qs, callback, _sign};
        } catch (error) {
            this.logger.error(`Error at login step #1`);

            throw error;
        }
    }

    /* */
    async _loginStep2(user, password, payload) {
        payload['user'] = user;
        payload['hash'] = crypto.createHash('md5').update(password).digest('hex').toUpperCase();
        payload['_json'] = true;
      
        try {
            const res = await axios.post('https://account.xiaomi.com/pass/serviceLoginAuth2', payload, {
                timeout: 5000,
                headers: {
                    // 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    // 'Cookie': `sdkVersion=accountsdk-18.8.15; userId=${username}; deviceId=${this.deviceId}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': UA(this.deviceId),
                    'Cookie': `sdkVersion=accountsdk-18.8.15; deviceId=${this.deviceId}`
                },
                transformRequest: data => Object.keys(data)
                    .reduce((pr, cr) => [...pr, `${encodeURIComponent(cr)}=${encodeURIComponent(data[cr])}`], [])
                    .join('&')
            });
            const resData = res.data;

            this.logger.debug(`Login step #2: ${JSON.stringify(resData)}`);

            return _replaceSTART(resData);
        } catch (error) {
            this.logger.error(`Error at login step #2`);

            throw error;
        }
    }

    /* Login step 3 (get serviceToken) */
    async _loginStep3(location) {
        try {
            const res = await axios.get(location, {
                timeout: 5000,
                headers: {
                    // 'Cookie': `sdkVersion=accountsdk-18.8.15; userId=${username}; deviceId=${this.deviceId}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': UA(this.deviceId),
                    'Cookie': `sdkVersion=accountsdk-18.8.15; deviceId=${this.deviceId}`
                }
            });
            
            const cookies = res.headers['set-cookie'].join('; ');
            const token = cookies.match(/serviceToken=.*?;\s{1}/g)[0].replace('; ', '').substr(13);

            this.logger.debug(`Login step #3 (cookies): ${JSON.stringify(cookies)}`);

            return token;
        } catch (error) {
            this.logger.error(`Error at login step #3`);

            throw error;
        }
    }

    /* */
    async getDevices(server) {
        const payload =  RC4 ? '{"getVirtualModel":true,"getHuamiDevices":1,"get_split_device":false,"support_smart_home":true}' // RC4
            : '{"getVirtualModel":true,"getHuamiDevices":1}'; //non RC4

        const rr = await this._request(server, '/home/device_list', payload);
        
        if (rr != undefined && rr.message === 'ok')
            return rr.result.list;
        else
            return undefined;
    }

    /* */
    async _request(server, url, payload) {
        const baseurl = server == 'cn' ? `https://api.io.mi.com/app` : `https://${server}.api.io.mi.com/app`;

        const nonce = this._genNonce();
        const d = this._genSignature(url, nonce, {'data': payload});

        let headers = {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'x-xiaomi-protocal-flag-cli': 'PROTOCAL-HTTP2',
            'User-Agent': UA(this.deviceId),
            'Cookie': `userId=${this.#auth['user_id']}; serviceToken=${this.#auth['service_token']}; yetAnotherServiceToken=${this.#auth['service_token']}; locale=en_US; timezone=GMT%2B01%3A00; is_daylight=1; dst_offset=3600000; channel=MI_APP_STORE`,
        };

        if (RC4) {
            headers = Object.assign(headers, {
                'Accept-Encoding': 'identity', //RC4
                'MIOT-ENCRYPT-ALGORITHM': 'ENCRYPT-RC4', //RC4
            });
        }

        try {
            const res = await axios.post([baseurl, url].join(''), d, {
                timeout: 5000,
                headers,
                transformRequest: data => Object.keys(data)
                    .reduce((pr, cr) => [...pr, `${encodeURIComponent(cr)}=${encodeURIComponent(data[cr])}`], [])
                    .join('&')
            });

            const resData = (RC4 && this.cryptrc4) ? JSON.parse(this.cryptrc4.decode(res.data)) : res.data;

            this.logger.debug(JSON.stringify(resData));

            return resData;
        } catch (error) {
            this.logger.error(error.stack);

            return undefined;
        }
    }

    /* */
    _genNonce() {
        let millis = Buffer.allocUnsafe(4);

        millis.writeUInt32BE(Math.round(new Date().getTime() / 60000));

        return Buffer.concat([
            Buffer.from(crypto.randomBytes(8)),
            millis
        ]).toString('base64');
    }

    /* */
    _genSignature(url, nonce, _payload) {
        const signed_nonce = crypto.createHash('sha256')
            .update(Buffer.concat([
                Buffer.from(this.#auth.ssecurity, 'base64'),
                Buffer.from(nonce, 'base64')
            ])).digest();

        let payload = _payload || {data: ''};

        if (RC4) {
            /* RC4 */
            this.cryptrc4 = new CryptRC4(signed_nonce, 1024);

            payload['rc4_hash__'] = this._genEncryptSignature(url, signed_nonce, [`data=${payload['data']}`]);

            for (const key in payload)
                payload[key] = this.cryptrc4.encode(payload[key]);
            
            payload['signature'] = this._genEncryptSignature(url, signed_nonce, [`data=${payload['data']}`, `rc4_hash__=${payload['rc4_hash__']}`]);
            
            payload['ssecurity'] = this.#auth.ssecurity; //RC4
            /* RC4  end */
        } else {
            /* non RC4 */
            const d = [url, signed_nonce.toString('base64'), nonce, `data=${payload['data']}`].join('&');

            payload['signature'] = crypto.createHmac('sha256', Uint8Array.from(Buffer.from(signed_nonce.toString('base64'), 'base64'))).update(d).digest('base64');
            /* non RC4 end*/
        }

        payload['_nonce'] = nonce;

        return payload;
    }

    /* */
    _genEncryptSignature(url, signed_nonce, [...payload] /* array */) {
        const d = ['POST', url || '', ...payload, signed_nonce.toString('base64')].join('&');
        return crypto.createHash('sha1').update(d, 'utf8').digest('base64');
    }
};

/* */
function _replaceSTART(d) {
    if (d.includes('&&&START&&&'))
        return JSON.parse(String(d).replace('&&&START&&&', ''));
    else
        return undefined;
}

/*   based on
 *   https://github.com/sipiyou/edomi-roboroc/blob/main/php/cryptRC4.php
 */
class CryptRC4 {

    constructor(key, rounds) {
        this.setKey(key || '', rounds);
    }
 
    setKey(key, rounds) {
        let ksa = Array.from({length: 256}, (v, k) => k);
        let i = 0;
        let j = 0;

        if (key.length > 0) {
            key = Buffer.from(key);
            let len = key.length;
     
            for (i = 0; i < 256; i++) {
                j = (j + ksa[i] + key[i % len]) & 255;
                [ksa[i], ksa[j]] = [ksa[j], ksa[i]];
            }

            i = j = 0;

            for (let c = 0; c < rounds; c++) {
                i = (i + 1) & 255;
                j = (j + ksa[i]) & 255;
                [ksa[i], ksa[j]] = [ksa[j], ksa[i]];
            }
        }

        this._ksa = ksa;
        this._idx = i;
        this._jdx = j;
    }
 
    crypt(data) {
        let ksa = (this._ksa || []).slice(0); // Array copy
        let i = this._idx || 0; 
        let j = this._jdx || 0;

        let len = data.length;
        let out = Buffer.alloc(len);

        for (let c = 0; c < len; c++) {
            i = (i + 1) & 255;
            j = (j + ksa[i]) & 255;
            [ksa[i], ksa[j]] = [ksa[j], ksa[i]];

            out[c] = data[c] ^ ksa[(ksa[i] + ksa[j]) & 255];
        }

        return out;
    }

    encode(data) {
        return this.crypt(Buffer.from(data, 'utf8')).toString('base64');
    }

    decode(data) {
        return this.crypt(Buffer.from(data, 'base64')).toString('utf8');
    }
}    //end of RC4 class
