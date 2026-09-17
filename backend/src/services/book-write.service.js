const bookRepository = require('../repositories/book-write.repository');
const prisma = require('../config/database');
const catalogRepository = require('../repositories/catalog.repository');
const { ACCOUNT_STATUS, ROLES } = require('../constants/auth');
const AppException = require('../exceptions/app.exception');
const HTTP = require('../constants/http');

async function createBook(user, input) {
  if (
    !user ||
    ![ROLES.SELLER, ROLES.BUYER].includes(user.role) ||
    user.status !== ACCOUNT_STATUS.ACTIVE
  )
    throw new AppException('BOOK_NOT_ALLOWED', HTTP.FORBIDDEN);
  if (user.role === ROLES.BUYER && (!input.allowExchange || Number(input.price) !== 0))
    throw new AppException('BOOK_NOT_ALLOWED', HTTP.FORBIDDEN);
  const options = await catalogRepository.findBookOptions();
  const valid = (items, id) => items.some((item) => item.id === id);
  if (
    ![options.genres, options.languages, options.conditions, options.cities].every((items, index) =>
      valid(items, [input.genreId, input.languageId, input.conditionId, input.cityId][index]),
    )
  )
    throw new AppException('BOOK_LOOKUP_INVALID', HTTP.UNPROCESSABLE, {
      genreId: 'BOOK_LOOKUP_INVALID',
      languageId: 'BOOK_LOOKUP_INVALID',
      conditionId: 'BOOK_LOOKUP_INVALID',
      cityId: 'BOOK_LOOKUP_INVALID',
    });
  const book = await bookRepository.createBook({
    title: input.title,
    author: input.author,
    publisher: input.publisher,
    publicationYear: input.publicationYear,
    isbn: input.isbn,
    description: input.description,
    imageUrl: input.imageUrl,
    price: input.price,
    allowExchange: input.allowExchange,
    ownerId: user.id,
    genreId: input.genreId,
    languageId: input.languageId,
    conditionId: input.conditionId,
    pickupLocations: { create: { cityId: input.cityId } },
    ...(input.imageUrl
      ? { images: { create: { url: input.imageUrl, altText: input.title } } }
      : {}),
  });
  return book;
}

async function getBookOptions() {
  return catalogRepository.findBookOptions();
}
async function getOwnedBook(userId, bookId) {
  const book = await bookRepository.findOwnedBook(userId, bookId);
  if (!book) throw new AppException('BOOK_NOT_FOUND', HTTP.NOT_FOUND);
  return book;
}
async function updateBook(user, bookId, input) {
  const existing = await getOwnedBook(user.id, bookId);
  if (!['ACTIVE', 'ARCHIVED'].includes(existing.status))
    throw new AppException('BOOK_STATUS_INVALID', HTTP.CONFLICT);
  if (user.role === ROLES.BUYER && (!input.allowExchange || Number(input.price) !== 0))
    throw new AppException('BOOK_NOT_ALLOWED', HTTP.FORBIDDEN);
  const options = await catalogRepository.findBookOptions();
  const valid = (items, id) => items.some((item) => item.id === id);
  if (
    ![options.genres, options.languages, options.conditions, options.cities].every((items, index) =>
      valid(items, [input.genreId, input.languageId, input.conditionId, input.cityId][index]),
    )
  )
    throw new AppException('BOOK_LOOKUP_INVALID', HTTP.UNPROCESSABLE);
  return prisma.$transaction(async (tx) => {
    const data = {
      title: input.title,
      author: input.author,
      publisher: input.publisher,
      publicationYear: input.publicationYear,
      isbn: input.isbn,
      description: input.description,
      imageUrl: input.imageUrl,
      price: input.price,
      allowExchange: input.allowExchange,
      genreId: input.genreId,
      languageId: input.languageId,
      conditionId: input.conditionId,
      pickupLocations: { deleteMany: {}, create: { cityId: input.cityId } },
    };
    return bookRepository.updateOwnedBook(user.id, bookId, data, tx);
  });
}
async function archiveBook(userId, bookId) {
  const result = await bookRepository.archiveOwnedBook(userId, bookId);
  if (!result.count) throw new AppException('BOOK_STATUS_INVALID', HTTP.CONFLICT);
  return result;
}
async function deleteBook(userId, bookId) {
  const result = await bookRepository.deleteArchivedBook(userId, bookId);
  if (!result.count) throw new AppException('BOOK_STATUS_INVALID', HTTP.CONFLICT);
  return result;
}

module.exports = { createBook, getBookOptions, getOwnedBook, updateBook, archiveBook, deleteBook };
