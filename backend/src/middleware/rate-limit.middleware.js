const { rateLimit } = require('express-rate-limit');
const AUTH = require('../constants/auth');
const HTTP = require('../constants/http');
const AppException = require('../exceptions/app.exception');

const limiter = (limit, skipSuccessfulRequests = false) =>
  rateLimit({
    windowMs: AUTH.RATE_WINDOW_MS,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: (req, res, next) =>
      next(new AppException('TOO_MANY_ATTEMPTS', HTTP.TOO_MANY_REQUESTS)),
  });

module.exports = {
  loginLimiter: limiter(AUTH.LOGIN_LIMIT, true),
  registerLimiter: limiter(AUTH.REGISTER_LIMIT),
};
