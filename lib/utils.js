const crypto = require('crypto');

async function sleep(ms) {
    return new Promise(resolve => {
        const id = crypto.randomBytes(8).toString('hex');

        global.sleepTimeouts[id] = setTimeout(() => {
            delete global.sleepTimeouts[id];
            resolve();
        }, ms);
    });
}

function reverseMac(mac) {
    return mac.match(/[\da-f]{2}/g).reverse().join('');
}

function decodeMiioJson(raw, search) {
    const RE_JSON1 = /msg:(.+) length:([0-9]+) bytes/g;
    const RE_JSON2 = /\{.+\}/g;

    if (raw.includes(search) == false)
        return [];

    let m = RE_JSON1.exec(raw);
    
    if (m != undefined) {
        raw = String(m[1]).substring(0, Number(m[2]));
    } else {
        m = RE_JSON2.exec(raw);
        raw = m[0];
    }

    const items = raw.replace('}{', '}\n{').split('\n');
    return items
        .filter(el => el.includes(search))
        .map(el => JSON.parse(el));
}

/*  */
module.exports = {
    sleep,
    reverseMac,
    decodeMiioJson
};