const EXCEPTIONS = require('../constants/exceptions');
const AUTH = require('../constants/auth');

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32 || secret.startsWith('replace-')) {
  throw new Error(EXCEPTIONS.AUTH_CONFIGURATION);
}
const secure = process.env.NODE_ENV === 'production';
const cookieOptions = Object.freeze({ httpOnly: true, secure, sameSite: 'lax', path: '/' });

module.exports = Object.freeze({
  secret,
  cookieOptions,
  tokenCookie: secure ? '__Host-bookie_token' : 'bookie_token',
  csrfCookie: secure ? '__Host-bookie_csrf' : 'bookie_csrf',
  tokenCookieOptions: Object.freeze({ ...cookieOptions, maxAge: AUTH.SESSION_SECONDS * 1000 }),
});
