const profileRepository = require('../repositories/profile.repository');
const catalogRepository = require('../repositories/catalog.repository');
const AppException = require('../exceptions/app.exception');
const HTTP = require('../constants/http');

async function getProfile(userId, filters = {}) {
  const profile = await profileRepository.findProfile(userId);
  const [options, sellerBooks] = await Promise.all([catalogRepository.findRegistrationOptions(), profile.role === 'SELLER' ? profileRepository.findSellerBooks(userId, filters) : Promise.resolve([])]);
  return { profile, sellerBooks, ...options };
}

async function updateProfile(userId, input) {
  const options = await catalogRepository.findRegistrationOptions();
  const valid = (items, ids) => ids.every((id) => items.some((item) => item.id === id));
  if (!valid(options.genres, input.genreIds) || !valid(options.languages, input.languageIds)) throw new AppException('INVALID_INTERESTS', HTTP.UNPROCESSABLE);
  return profileRepository.updateProfile(userId, input);
}

module.exports = { getProfile, updateProfile };
