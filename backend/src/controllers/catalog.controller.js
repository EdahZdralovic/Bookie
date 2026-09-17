const { parseFilters } = require('../validators/catalog.validator');
const bookService = require('../services/book.service');

async function show(req, res, next) {
  try {
    const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const filters = parseFilters(req.query);
    return res.render('pages/books', {
      title: 'Explore books',
      ...(await bookService.getCatalogData(search, filters)),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { show };
