const profileService = require('../services/profile.service');
const validator = require('../validators/profile.validator');
const STRINGS = require('../constants/strings');
const HTTP = require('../constants/http');
const AppException = require('../exceptions/app.exception');

async function renderProfile(req, res, error = null) {
  const filters = { status: typeof req.query.status === 'string' ? req.query.status.toUpperCase() : '', sort: typeof req.query.sort === 'string' ? req.query.sort : 'newest' };
  const data = await profileService.getProfile(req.user.id, filters);
  const profile = data.profile;
  const values = req.body && Object.keys(req.body).length ? { ...req.body, avatarUrl: req.body.avatarUrl || '', genreIds: Array.isArray(req.body.genreIds) ? req.body.genreIds : req.body.genreIds ? [req.body.genreIds] : [], languageIds: Array.isArray(req.body.languageIds) ? req.body.languageIds : req.body.languageIds ? [req.body.languageIds] : [] } : {
    avatarUrl: profile.avatarUrl || '', genreIds: profile.genreInterests.map((item) => String(item.genreId)), languageIds: profile.languageInterests.map((item) => String(item.languageId)),
  };
  return res.status(error?.status || HTTP.OK).render('pages/profile', { title: STRINGS.PROFILE.PAGE_TITLE, ...data, values, filters, errors: error?.fields || {}, formError: error?.message || '', saved: req.query.saved === '1' });
}

async function show(req, res) { return renderProfile(req, res); }

async function update(req, res) {
  try {
    await profileService.updateProfile(req.user.id, validator.validateProfile(req.body));
    return res.redirect(HTTP.REDIRECT, '/profile?saved=1');
  } catch (error) {
    if (!(error instanceof AppException)) throw error;
    return renderProfile(req, res, error);
  }
}

module.exports = { show, update, renderProfile };
