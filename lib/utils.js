function reverseMac(mac) {
    return mac.match(/[\da-f]{2}/g).reverse().join('');
}

module.exports = {
    reverseMac
};