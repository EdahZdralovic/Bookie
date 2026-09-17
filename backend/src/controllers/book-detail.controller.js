const detailService = require('../services/book-detail.service');
const AppException = require('../exceptions/app.exception');
const HTTP = require('../constants/http');

async function show(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1)
      return next(new AppException('NOT_FOUND', HTTP.NOT_FOUND));
    const book = await detailService.getBook(id, req.user?.id);
    if (!book) return next(new AppException('NOT_FOUND', HTTP.NOT_FOUND));
    return res.render('pages/book-detail', {
      title: book.title,
      book,
      exchangeError: req.query.exchangeError === '1',
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { show };
