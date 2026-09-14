const EXCEPTIONS = require('../constants/exceptions');
const HTTP = require('../constants/http');
const AppException = require('../exceptions/app.exception');

function validateProfile(body = {}) {
  const avatarUrl = typeof body.avatarUrl === 'string' ? body.avatarUrl.trim() : '';
  const genreIds = [...new Set((Array.isArray(body.genreIds) ? body.genreIds : body.genreIds ? [body.genreIds] : []).map(Number))];
  const languageIds = [...new Set((Array.isArray(body.languageIds) ? body.languageIds : body.languageIds ? [body.languageIds] : []).map(Number))];
  const errors = {};
  if (avatarUrl) { try { if (!['http:', 'https:'].includes(new URL(avatarUrl).protocol)) throw new Error(); } catch { errors.avatarUrl = EXCEPTIONS.PROFILE_AVATAR_INVALID; } }
  if (!genreIds.length) errors.genreIds = EXCEPTIONS.GENRES_REQUIRED;
  if (!languageIds.length) errors.languageIds = EXCEPTIONS.LANGUAGES_REQUIRED;
  if (genreIds.some((id) => !Number.isSafeInteger(id) || id < 1) || languageIds.some((id) => !Number.isSafeInteger(id) || id < 1)) errors.interests = EXCEPTIONS.INVALID_INTERESTS;
  if (Object.keys(errors).length) throw new AppException('VALIDATION_FAILED', HTTP.UNPROCESSABLE, errors);
  return { avatarUrl: avatarUrl || null, genreIds, languageIds };
}

module.exports = { validateProfile };
