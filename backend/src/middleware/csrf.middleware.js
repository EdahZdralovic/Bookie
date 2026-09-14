const crypto = require('node:crypto');
const config = require('../config/auth');
const AUTH = require('../constants/auth');
const HTTP = require('../constants/http');
const AppException = require('../exceptions/app.exception');
const { hashToken } = require('../utils/token');

function signature(nonce, req) {
  const binding = typeof req.cookies[config.tokenCookie] === 'string' ? hashToken(req.cookies[config.tokenCookie]) : '';
  return crypto.createHmac('sha256', config.secret).update(`${nonce}:${binding}`).digest('hex');
}

function equal(left, right) {
  return typeof left === 'string' && typeof right === 'string' && left.length === right.length
    && crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

function valid(token, req) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(token)) return false;
  const [nonce, digest] = token.split('.');
  return equal(digest, signature(nonce, req));
}

function provideCsrf(req, res, next) {
  let token = req.cookies[config.csrfCookie];
  if (!valid(token, req)) {
    const nonce = crypto.randomBytes(AUTH.CSRF_BYTES).toString('hex');
    token = `${nonce}.${signature(nonce, req)}`;
    res.cookie(config.csrfCookie, token, config.tokenCookieOptions);
  }
  res.locals.csrfToken = token;
  return next();
}

function protectCsrf(req, res, next) {
  const submitted = req.body?._csrf || req.get('x-csrf-token');
  const cookie = req.cookies[config.csrfCookie];
  if (!valid(cookie, req) || typeof submitted !== 'string' || !/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(submitted) || !equal(cookie, submitted)) {
    return next(new AppException('CSRF_INVALID', HTTP.FORBIDDEN));
  }
  return next();
}

module.exports = { provideCsrf, protectCsrf };
