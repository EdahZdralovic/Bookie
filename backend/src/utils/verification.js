const crypto = require('node:crypto');
function createCode() {
  return String(crypto.randomInt(100000, 1000000));
}
function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}
module.exports = { createCode, hashCode };
