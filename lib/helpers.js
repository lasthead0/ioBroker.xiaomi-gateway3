'use strict';

const net = require('net');
/* */
const miioProtocol = require('js-miio-simple');

/* Utils for miIO protocol */
class MiioHelper {
    /* Check is device available (with miIO) */
    static async discover(ip) {
        if (ip != undefined && ip != '') {
            const miIO = new miioProtocol(ip);
            const result = await miIO.discover();

            return result[0];
        } else {
            return false;
        }
    }
}

/* Helper class for Gateway3 */
class Gateway3Helper {
    /* Check if port opened */
    static async checkPort(port, ip) {
        try {
            return new Promise((resolve, reject) => {
                const socket = net.Socket();

                socket.setTimeout(1000);

                const onError = () => {
                    socket.destroy();
                    reject(false);
                };

                socket.connect(port, ip, () => {
                    socket.end();
                    resolve(true);
                })
                    .once('error', onError)
                    .once('timeout', onError)
                ;
            })
                .then(msg => msg)
                .catch(error => error)
            ;
        } catch (error) {
            return false;
        }
    }
}

module.exports = {MiioHelper, Gateway3Helper};