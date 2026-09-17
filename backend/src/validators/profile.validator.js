const EXCEPTIONS = require('../constants/exceptions');
const HTTP = require('../constants/http');
const AppException = require('../exceptions/app.exception');

function validateProfile(body = {}, role = 'BUYER') {
  const avatarUrl = typeof body.avatarUrl === 'string' ? body.avatarUrl.trim() : '';
  const cityId = body.cityId ? Number(body.cityId) : undefined;
  const bio = typeof body.bio === 'string' ? body.bio.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const genreIds = [
    ...new Set(
      (Array.isArray(body.genreIds) ? body.genreIds : body.genreIds ? [body.genreIds] : []).map(
        Number,
      ),
    ),
  ];
  const languageIds = [
    ...new Set(
      (Array.isArray(body.languageIds)
        ? body.languageIds
        : body.languageIds
          ? [body.languageIds]
          : []
      ).map(Number),
    ),
  ];
  const errors = {};
  if (cityId !== undefined && (!Number.isInteger(cityId) || cityId < 1 || cityId > 2147483647))
    errors.cityId = EXCEPTIONS.INVALID_CITY;
  if (bio.length > 1000) errors.bio = EXCEPTIONS.PAYLOAD_TOO_LARGE;
  if (avatarUrl && !avatarUrl.startsWith('/users/')) {
    try {
      if (!['http:', 'https:'].includes(new URL(avatarUrl).protocol)) throw new Error();
    } catch {
      errors.avatarUrl = EXCEPTIONS.PROFILE_AVATAR_INVALID;
    }
  }
  if (role === 'BUYER' && !genreIds.length) errors.genreIds = EXCEPTIONS.GENRES_REQUIRED;
  if (role === 'BUYER' && !languageIds.length) errors.languageIds = EXCEPTIONS.LANGUAGES_REQUIRED;
  if (
    genreIds.some((id) => !Number.isSafeInteger(id) || id < 1) ||
    languageIds.some((id) => !Number.isSafeInteger(id) || id < 1)
  )
    errors.interests = EXCEPTIONS.INVALID_INTERESTS;
  if (!phone) errors.phone = EXCEPTIONS.PHONE_REQUIRED;
  else if (!/^\+?[0-9 ()-]{7,20}$/.test(phone)) errors.phone = EXCEPTIONS.PHONE_INVALID;
  if (Object.keys(errors).length)
    throw new AppException('VALIDATION_FAILED', HTTP.UNPROCESSABLE, errors);
  return { avatarUrl: avatarUrl || null, phone, genreIds, languageIds, cityId, bio };
}

module.exports = { validateProfile };
