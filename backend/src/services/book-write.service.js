const bookRepository = require('../repositories/book-write.repository');
const catalogRepository = require('../repositories/catalog.repository');
const { ACCOUNT_STATUS, ROLES } = require('../constants/auth');
const AppException = require('../exceptions/app.exception');
const HTTP = require('../constants/http');

async function createBook(user, input) {
  if (!user || user.role !== ROLES.SELLER || user.status !== ACCOUNT_STATUS.ACTIVE) throw new AppException('BOOK_NOT_ALLOWED', HTTP.FORBIDDEN);
  const options = await catalogRepository.findBookOptions();
  const valid = (items, id) => items.some((item) => item.id === id);
  if (![options.genres, options.languages, options.conditions, options.cities].every((items, index) => valid(items, [input.genreId, input.languageId, input.conditionId, input.cityId][index]))) throw new AppException('BOOK_LOOKUP_INVALID', HTTP.UNPROCESSABLE, { genreId: 'BOOK_LOOKUP_INVALID', languageId: 'BOOK_LOOKUP_INVALID', conditionId: 'BOOK_LOOKUP_INVALID', cityId: 'BOOK_LOOKUP_INVALID' });
  const book = await bookRepository.createBook({
    title: input.title, author: input.author, publisher: input.publisher,
    publicationYear: input.publicationYear, isbn: input.isbn, description: input.description,
    imageUrl: input.imageUrl, price: input.price, allowExchange: input.allowExchange,
    ownerId: user.id, genreId: input.genreId, languageId: input.languageId, conditionId: input.conditionId,
    pickupLocations: { create: { cityId: input.cityId } },
    ...(input.imageUrl ? { images: { create: { url: input.imageUrl, altText: input.title } } } : {}),
  });
  return book;
}

async function getBookOptions() { return catalogRepository.findBookOptions(); }

module.exports = { createBook, getBookOptions };
