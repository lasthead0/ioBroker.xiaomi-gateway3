const crypto = require('crypto');

function reverseMac(mac) {
    return mac.match(/[\da-f]{2}/g).reverse().join('');
}

async function sleep(ms) {
    return new Promise(resolve => {
        const id = crypto.randomBytes(16).toString('hex');

        global.sleepTimers[id] = setTimeout(() => {
            delete global.sleepTimers[id];
            resolve();
        }, ms);
    });
}

module.exports = {
    reverseMac,
    sleep
};