const profileRepository = require('../repositories/profile.repository');
const catalogRepository = require('../repositories/catalog.repository');
const AppException = require('../exceptions/app.exception');
const HTTP = require('../constants/http');
const EXCEPTIONS = require('../constants/exceptions');

async function getProfile(userId, filters = {}) {
  const profile = await profileRepository.findProfile(userId);
  const [options, sellerBooks] = await Promise.all([
    catalogRepository.findRegistrationOptions(),
    profile.role === 'SELLER'
      ? profileRepository.findSellerBooks(userId, filters)
      : Promise.resolve([]),
  ]);
  return { profile, sellerBooks, ...options };
}

async function updateProfile(userId, input) {
  const options = await catalogRepository.findRegistrationOptions();
  const valid = (items, ids) => ids.every((id) => items.some((item) => item.id === id));
  if (!valid(options.genres, input.genreIds) || !valid(options.languages, input.languageIds))
    throw new AppException('INVALID_INTERESTS', HTTP.UNPROCESSABLE);
  return profileRepository.updateProfile(userId, input);
}
async function exchangeBooks(userId) {
  return profileRepository.findExchangeBooks(userId);
}
async function ownedBooks(userId) {
  return profileRepository.findOwnedBooks(userId);
}
async function publicSeller(userId) {
  const seller = await profileRepository.findPublicSeller(userId);
  if (!seller) throw new AppException('NOT_FOUND', HTTP.NOT_FOUND);
  const ratings = seller.sellerOrders.flatMap((order) =>
    order.items.map((item) => item.review?.rating).filter(Boolean),
  );
  return {
    ...seller,
    sellerOrders: undefined,
    reviewCount: ratings.length,
    averageRating: ratings.length
      ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
      : 0,
    bookCount: seller.books.length,
  };
}
async function archiveExchangeBook(userId, bookId) {
  return profileRepository.updateBook(userId, bookId, { status: 'ARCHIVED' });
}
async function deleteArchivedExchangeBook(userId, bookId) {
  return profileRepository.deleteBook(userId, bookId);
}
async function getExchangeBook(userId, bookId) {
  return profileRepository.findExchangeBook(userId, bookId);
}
async function editExchangeBook(userId, bookId, data) {
  const fields = {};
  if (!data.title) fields.title = EXCEPTIONS.BOOK_TITLE_REQUIRED;
  if (!data.author) fields.author = EXCEPTIONS.BOOK_AUTHOR_REQUIRED;
  if (!data.publisher) fields.publisher = EXCEPTIONS.BOOK_PUBLISHER_REQUIRED;
  if (!data.description) fields.description = EXCEPTIONS.BOOK_DESCRIPTION_REQUIRED;
  if (Object.keys(fields).length)
    throw new AppException('VALIDATION_FAILED', HTTP.UNPROCESSABLE, fields);
  const result = await profileRepository.updateBook(userId, bookId, data);
  if (!result.count) throw new AppException('BOOK_NOT_ALLOWED', HTTP.FORBIDDEN);
  return result;
}

module.exports = {
  getProfile,
  updateProfile,
  exchangeBooks,
  ownedBooks,
  publicSeller,
  archiveExchangeBook,
  deleteArchivedExchangeBook,
  getExchangeBook,
  editExchangeBook,
};
