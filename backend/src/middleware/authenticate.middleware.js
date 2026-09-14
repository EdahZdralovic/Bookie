const authService = require('../services/auth.service');
const config = require('../config/auth');
const AppException = require('../exceptions/app.exception');
const HTTP = require('../constants/http');

async function authenticate(req, res, next) {
  req.user = null;
  res.locals.currentUser = null;
  const token = req.cookies[config.tokenCookie];
  if (typeof token !== 'string' || !token) return next();
  try {
    req.user = await authService.authenticate(token);
    res.locals.currentUser = req.user;
    return next();
  } catch (error) {
    if (error instanceof AppException && [HTTP.UNAUTHORIZED, HTTP.FORBIDDEN].includes(error.status)) {
      req.authError = error;
      res.clearCookie(config.tokenCookie, config.cookieOptions);
      delete req.cookies[config.tokenCookie];
      return next();
    }
    return next(error);
  }
}

module.exports = authenticate;
