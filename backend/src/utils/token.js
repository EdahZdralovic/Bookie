const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const config = require('../config/auth');
const AUTH = require('../constants/auth');
const HTTP = require('../constants/http');
const AppException = require('../exceptions/app.exception');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function signToken(userId) {
  const token = jwt.sign({}, config.secret, {
    algorithm: AUTH.JWT_ALGORITHM,
    subject: String(userId),
    jwtid: crypto.randomUUID(),
    issuer: AUTH.JWT_ISSUER,
    audience: AUTH.JWT_AUDIENCE,
    expiresIn: AUTH.SESSION_SECONDS,
  });
  const payload = jwt.decode(token);
  return { token, tokenHash: hashToken(token), expiresAt: new Date(payload.exp * 1000) };
}

function verifyToken(token) {
  try {
    const payload = jwt.verify(token, config.secret, {
      algorithms: [AUTH.JWT_ALGORITHM], issuer: AUTH.JWT_ISSUER, audience: AUTH.JWT_AUDIENCE,
    });
    if (typeof payload !== 'object' || !/^[1-9]\d*$/.test(payload.sub) || !Number.isSafeInteger(Number(payload.sub)) || typeof payload.exp !== 'number' || typeof payload.jti !== 'string') {
      throw new AppException('INVALID_TOKEN', HTTP.UNAUTHORIZED);
    }
    return payload;
  } catch (error) {
    if (error instanceof AppException) throw error;
    throw new AppException(error.name === 'TokenExpiredError' ? 'SESSION_EXPIRED' : 'INVALID_TOKEN', HTTP.UNAUTHORIZED);
  }
}

module.exports = { signToken, verifyToken, hashToken };
