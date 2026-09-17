const EXCEPTIONS = require('../constants/exceptions');
const HTTP = require('../constants/http');
const AppException = require('../exceptions/app.exception');

const value = (input) => (typeof input === 'string' ? input.trim() : '');
const id = (input) => /^\d+$/.test(value(input)) && Number(input) > 0;
const url = (input) => {
  const candidate = value(input);
  if (candidate.startsWith('/users/')) return true;
  try {
    const parsed = new URL(candidate);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

function validateBook(body = {}) {
  const data = {
    title: value(body.title),
    author: value(body.author),
    publisher: value(body.publisher),
    description: value(body.description),
    isbn: value(body.isbn) || null,
    imageUrl: value(body.imageUrl) || null,
    publicationYear: Number(value(body.publicationYear)),
    price: value(body.price),
    allowExchange: body.allowExchange === 'on' || body.allowExchange === true,
    genreId: Number(body.genreId),
    languageId: Number(body.languageId),
    conditionId: Number(body.conditionId),
    cityId: Number(body.cityId),
  };
  const errors = {};
  if (!data.title) errors.title = EXCEPTIONS.BOOK_TITLE_REQUIRED;
  if (!data.author) errors.author = EXCEPTIONS.BOOK_AUTHOR_REQUIRED;
  if (!data.publisher) errors.publisher = EXCEPTIONS.BOOK_PUBLISHER_REQUIRED;
  if (!data.description) errors.description = EXCEPTIONS.BOOK_DESCRIPTION_REQUIRED;
  if (
    !Number.isInteger(data.publicationYear) ||
    data.publicationYear < 1 ||
    data.publicationYear > new Date().getFullYear()
  )
    errors.publicationYear = EXCEPTIONS.BOOK_YEAR_INVALID;
  if (!/^\d+(\.\d{1,2})?$/.test(data.price) || Number(data.price) < 0)
    errors.price = EXCEPTIONS.BOOK_PRICE_INVALID;
  if (Number(data.price) === 0 && !data.allowExchange)
    errors.price = EXCEPTIONS.BOOK_PRICE_EXCHANGE;
  for (const field of ['genreId', 'languageId', 'conditionId', 'cityId'])
    if (!id(body[field])) errors[field] = EXCEPTIONS.BOOK_LOOKUP_INVALID;
  if (data.imageUrl && !url(data.imageUrl)) errors.imageUrl = EXCEPTIONS.BOOK_IMAGE_INVALID;
  if (Object.keys(errors).length)
    throw new AppException('VALIDATION_FAILED', HTTP.UNPROCESSABLE, errors);
  return { ...data, price: Number(data.price).toFixed(2) };
}

module.exports = { validateBook };
