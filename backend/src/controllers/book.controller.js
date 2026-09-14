const bookService = require('../services/book-write.service');
const validator = require('../validators/book.validator');
const STRINGS = require('../constants/strings');
const HTTP = require('../constants/http');
const AppException = require('../exceptions/app.exception');

async function renderCreate(req, res, error = null) {
  const options = await bookService.getBookOptions();
  return res.status(error?.status || HTTP.OK).render('pages/book-create', {
    title: STRINGS.BOOK.PAGE_TITLE, options, values: req.body || {}, errors: error?.fields || {}, formError: error?.message || '',
  });
}

async function showCreate(req, res) { return renderCreate(req, res); }

async function create(req, res) {
  try {
    await bookService.createBook(req.user, validator.validateBook(req.body));
    return res.redirect(HTTP.REDIRECT, '/account?bookCreated=1');
  } catch (error) {
    if (!(error instanceof AppException)) throw error;
    return renderCreate(req, res, error);
  }
}

module.exports = { showCreate, create, renderCreate };
