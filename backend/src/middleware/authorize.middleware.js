const AppException = require('../exceptions/app.exception');
const HTTP = require('../constants/http');
const { PATHS } = require('../constants/auth');

function requireAuthentication(req, res, next) {
  if (!req.user) return next(req.authError || new AppException('AUTH_REQUIRED', HTTP.UNAUTHORIZED));
  return next();
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(req.authError || new AppException('AUTH_REQUIRED', HTTP.UNAUTHORIZED));
    if (!roles.includes(req.user.role)) return next(new AppException('FORBIDDEN', HTTP.FORBIDDEN));
    return next();
  };
}

function guestOnly(req, res, next) {
  if (req.user) return res.redirect(HTTP.REDIRECT, PATHS.ACCOUNT);
  return next();
}

module.exports = { requireAuthentication, authorize, guestOnly };
