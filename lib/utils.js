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

function fetchHashOfString(string) {
    return string.split('').map(v=>v.charCodeAt(0)).reduce((a,v)=>a+((a<<7)+(a<<3))^v).toString(16);
};

/*  */
function objectEquals(x, y) {
    'use strict';

    if (x === null || x === undefined || y === null || y === undefined) return x === y;
    
    // after this just checking type of one would be enough
    if (x.constructor !== y.constructor) return false;

    // if they are functions, they should exactly refer to same one (because of closures)
    if (x instanceof Function) return x === y;

    // if they are regexps, they should exactly refer to same one (it is hard to better equality check on current ES)
    if (x instanceof RegExp) return x === y;

    if (x === y || x.valueOf() === y.valueOf()) return true;
    if (Array.isArray(x) && x.length !== y.length) return false;

    // if they are dates, they must had equal valueOf
    if (x instanceof Date) return false;

    // if they are strictly equal, they both need to be object at least
    if (!(x instanceof Object)) return false;
    if (!(y instanceof Object)) return false;

    // recursive object equality check
    var p = Object.keys(x);
    return Object.keys(y).every(i => p.indexOf(i) !== -1) &&
        p.every(i => objectEquals(x[i], y[i]));
}

/*  */
module.exports = {
    sleep,
    reverseMac,
    decodeMiioJson,
    fetchHashOfString,
    objectEquals
};