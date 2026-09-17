const bookService = require('../services/book-write.service');
const validator = require('../validators/book.validator');
const STRINGS = require('../constants/strings');
const HTTP = require('../constants/http');
const AppException = require('../exceptions/app.exception');
const { removeUploadedFile } = require('../utils/upload');

async function renderCreate(req, res, error = null) {
  const options = await bookService.getBookOptions();
  return res.status(error?.status || HTTP.OK).render('pages/book-create', {
    title: STRINGS.BOOK.PAGE_TITLE,
    options,
    values: req.body || {},
    user: req.user,
    exchangeMode: req.query.exchange === '1',
    errors: error?.fields || {},
    formError: error?.message || '',
  });
}

async function showCreate(req, res) {
  return renderCreate(req, res);
}

async function create(req, res) {
  try {
    if (req.query.exchange === '1') {
      req.body.price = '0';
      req.body.allowExchange = 'on';
    }
    req.body.imageUrl = req.file ? `/users/books-images/${req.file.filename}` : '';
    await bookService.createBook(req.user, validator.validateBook(req.body));
    return res.redirect(
      HTTP.REDIRECT,
      req.query.exchange === '1' ? '/exchange-books' : '/account?bookCreated=1',
    );
  } catch (error) {
    await removeUploadedFile(req.file);
    if (!(error instanceof AppException)) throw error;
    return renderCreate(req, res, error);
  }
}
async function renderEdit(req, res, error = null, book = null) {
  const options = await bookService.getBookOptions();
  const source = book || (await bookService.getOwnedBook(req.user.id, Number(req.params.id)));
  const values =
    req.body && Object.keys(req.body).length
      ? req.body
      : {
          ...source,
          genreId: source.genreId,
          languageId: source.languageId,
          conditionId: source.conditionId,
          cityId: source.pickupLocations[0]?.cityId,
          allowExchange: source.allowExchange,
        };
  return res.status(error?.status || HTTP.OK).render('pages/book-edit', {
    title: 'Edit book',
    options,
    values,
    user: req.user,
    errors: error?.fields || {},
    formError: error?.message || '',
    book: source,
  });
}
async function editForm(req, res, next) {
  try {
    return await renderEdit(req, res);
  } catch (error) {
    return next(error);
  }
}
async function update(req, res, next) {
  try {
    const book = await bookService.getOwnedBook(req.user.id, Number(req.params.id));
    if (req.file) req.body.imageUrl = `/users/books-images/${req.file.filename}`;
    else req.body.imageUrl = book.imageUrl || null;
    await bookService.updateBook(req.user, Number(req.params.id), validator.validateBook(req.body));
    return res.redirect(HTTP.REDIRECT, '/profile/books');
  } catch (error) {
    await removeUploadedFile(req.file);
    if (!(error instanceof AppException)) return next(error);
    try {
      return await renderEdit(req, res, error);
    } catch (renderError) {
      return next(renderError);
    }
  }
}
async function archive(req, res, next) {
  try {
    await bookService.archiveBook(req.user.id, Number(req.params.id));
    return res.redirect(HTTP.REDIRECT, '/profile/books');
  } catch (error) {
    return next(error);
  }
}
async function remove(req, res, next) {
  try {
    await bookService.deleteBook(req.user.id, Number(req.params.id));
    return res.redirect(HTTP.REDIRECT, '/profile/books');
  } catch (error) {
    return next(error);
  }
}

module.exports = { showCreate, create, renderCreate, editForm, update, archive, remove };
