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
  const options = page === 'register' ? await authService.getRegistrationOptions() : { cities: [], genres: [], languages: [] };
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
  return finishAuthentication(res, result);
}

async function logout(req, res) {
  await authService.logout(req.cookies[config.tokenCookie]);
  res.clearCookie(config.tokenCookie, config.cookieOptions);
  res.clearCookie(config.csrfCookie, config.cookieOptions);
  return res.redirect(HTTP.REDIRECT, AUTH.PATHS.LOGIN);
}

function account(req, res) {
  return res.render('pages/account', { title: TEXT.ACCOUNT_TITLE });
}

function me(req, res) {
  return res.json({ user: req.user });
}

module.exports = { formContext, renderForm, login, register, logout, account, me };
