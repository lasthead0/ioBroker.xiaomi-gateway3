const crypto = require('crypto');

function reverseMac(mac) {
    return mac.match(/[\da-f]{2}/g).reverse().join('');
}

async function sleep(ms) {
    return new Promise(resolve => {
        const id = crypto.randomBytes(8).toString('hex');

        global.sleepTimeouts[id] = setTimeout(() => {
            delete global.sleepTimeouts[id];
            resolve();
        }, ms);
    });
}

module.exports = {
    reverseMac,
    sleep
};