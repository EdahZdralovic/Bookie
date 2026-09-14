const bookService = require('../services/book.service');

async function show(req, res, next) {
  try {
    const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const filters = { genreId: /^\d+$/.test(req.query.genreId || '') ? Number(req.query.genreId) : undefined, languageId: /^\d+$/.test(req.query.languageId || '') ? Number(req.query.languageId) : undefined };
    return res.render('pages/books', { title: 'Explore books', ...await bookService.getCatalogData(search, filters) });
  } catch (error) { return next(error); }
}

module.exports = { show };
