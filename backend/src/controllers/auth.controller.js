const authService = require('../services/auth.service');
const validator = require('../validators/auth.validator');
const config = require('../config/auth');
const AUTH = require('../constants/auth');
const TEXT = require('../constants/auth-text');
const HTTP = require('../constants/http');

function formContext(page) {
  return (req, res, next) => {
    res.locals.authPage = page;
    res.locals.values = validator.safeValues(req.body);
    next();
  };
}

async function renderForm(req, res, error = null) {
  const page = res.locals.authPage;
  const options =
    page === 'register'
      ? await authService.getRegistrationOptions()
      : { cities: [], genres: [], languages: [] };
  return res.status(error?.status || HTTP.OK).render('pages/auth', {
    page,
    title: page === 'register' ? TEXT.REGISTER_BUTTON : TEXT.LOGIN_BUTTON,
    values: res.locals.values || validator.safeValues(),
    errors: error?.fields || {},
    formError: error?.message || req.authError?.message || '',
    ...options,
  });
}

function finishAuthentication(res, result) {
  res.cookie(config.tokenCookie, result.token, config.tokenCookieOptions);
  res.clearCookie(config.csrfCookie, config.cookieOptions);
  return res.redirect(HTTP.REDIRECT, AUTH.PATHS.ACCOUNT);
}

async function login(req, res) {
  const result = await authService.login(validator.validateLogin(req.body));
  return finishAuthentication(res, result);
}

async function register(req, res) {
  const result = await authService.register(validator.validateRegistration(req.body));
  if (result.verificationRequired)
    return res.redirect(HTTP.REDIRECT, `/verify-email?email=${encodeURIComponent(result.email)}`);
  return finishAuthentication(res, result);
}

async function verificationForm(req, res) {
  const user = req.query.email
    ? await require('../repositories/user.repository').findByEmail(req.query.email)
    : null;
  const remaining = user?.verificationCodeSentAt
    ? Math.max(0, 20 - Math.floor((Date.now() - user.verificationCodeSentAt.getTime()) / 1000))
    : 0;
  return res.render('pages/verify-email', {
    title: 'Verify email',
    email: req.query.email || '',
    resendAfter: remaining,
  });
}
async function verifyEmail(req, res, next) {
  try {
    const result = await authService.verifyEmail(req.body.email, req.body.code);
    return finishAuthentication(res, result);
  } catch (error) {
    if (error.code === 'EMAIL_VERIFICATION_INVALID')
      return res.status(error.status).render('pages/verify-email', {
        title: 'Verify email',
        email: req.body.email || '',
        resendAfter: 0,
        formError: error.message,
      });
    return next(error);
  }
}
async function resendVerification(req, res) {
  const result = await authService.resendVerification(req.body.email);
  return res.redirect(
    HTTP.REDIRECT,
    `/verify-email?email=${encodeURIComponent(req.body.email)}&resendAfter=${result.retryAfter || 20}`,
  );
}

async function logout(req, res) {
  await authService.logout(req.cookies[config.tokenCookie]);
  res.clearCookie(config.tokenCookie, config.cookieOptions);
  res.clearCookie(config.csrfCookie, config.cookieOptions);
  return res.redirect(HTTP.REDIRECT, AUTH.PATHS.LOGIN);
}

function account(req, res) {
  return res.render('pages/account', {
    title: TEXT.ACCOUNT_TITLE,
    bookCreated: req.query.bookCreated === '1',
  });
}

function me(req, res) {
  return res.json({ user: req.user });
}

module.exports = {
  formContext,
  renderForm,
  login,
  register,
  verificationForm,
  verifyEmail,
  resendVerification,
  logout,
  account,
  me,
};
