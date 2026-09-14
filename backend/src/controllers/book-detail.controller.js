const detailService = require('../services/book-detail.service');
const AppException = require('../exceptions/app.exception');
const HTTP = require('../constants/http');

async function show(req, res, next) {
  try {
    const book = await detailService.getBook(req.params.publicId);
    if (!book) return next(new AppException('NOT_FOUND', HTTP.NOT_FOUND));
    return res.render('pages/book-detail', { title: book.title, book });
  } catch (error) { return next(error); }
}

module.exports = { show };
