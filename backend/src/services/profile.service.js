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
  if (input.cityId !== undefined && !options.cities.some((city) => city.id === input.cityId))
    throw new AppException('INVALID_CITY', HTTP.UNPROCESSABLE, { cityId: EXCEPTIONS.INVALID_CITY });
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
  return require('./book-write.service').archiveBook(userId, bookId);
}
async function deleteArchivedExchangeBook(userId, bookId) {
  return require('./book-write.service').deleteBook(userId, bookId);
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

async function changePassword(userId, input) {
  const bcrypt = require('bcryptjs');
  const AUTH = require('../constants/auth');
  const prisma = require('../config/database');
  const password = typeof input.password === 'string' ? input.password : '';
  const currentPassword = typeof input.currentPassword === 'string' ? input.currentPassword : '';
  const fields = {};
  if (!currentPassword || Buffer.byteLength(currentPassword) > AUTH.PASSWORD.MAX_BYTES)
    fields.currentPassword = EXCEPTIONS.INVALID_CREDENTIALS;
  if (
    password.length < AUTH.PASSWORD.MIN_LENGTH ||
    !/\p{Lu}/u.test(password) ||
    !/[0-9]/.test(password)
  )
    fields.password = EXCEPTIONS.WEAK_PASSWORD;
  if (Buffer.byteLength(password) > AUTH.PASSWORD.MAX_BYTES)
    fields.password = EXCEPTIONS.PASSWORD_TOO_LONG;
  if (password !== input.repeatPassword) fields.repeatPassword = EXCEPTIONS.PASSWORD_MISMATCH;
  if (Object.keys(fields).length)
    throw new AppException('VALIDATION_FAILED', HTTP.UNPROCESSABLE, fields);
  const user = await profileRepository.findProfile(userId);
  if (!(await bcrypt.compare(currentPassword, user.passwordHash)))
    throw new AppException('INVALID_CREDENTIALS', HTTP.UNPROCESSABLE, {
      currentPassword: EXCEPTIONS.INVALID_CREDENTIALS,
    });
  const passwordHash = await bcrypt.hash(password, AUTH.PASSWORD.HASH_ROUNDS);
  return prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    await tx.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });
}

module.exports = {
  getProfile,
  changePassword,
  updateProfile,
  exchangeBooks,
  ownedBooks,
  publicSeller,
  archiveExchangeBook,
  deleteArchivedExchangeBook,
  getExchangeBook,
  editExchangeBook,
};
