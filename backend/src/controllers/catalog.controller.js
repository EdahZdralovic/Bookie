const bookService = require('../services/book.service');

async function show(req, res, next) {
  try {
    const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const filters = {
      genreId: /^\d+$/.test(req.query.genreId || '') ? Number(req.query.genreId) : undefined,
      languageId: /^\d+$/.test(req.query.languageId || '')
        ? Number(req.query.languageId)
        : undefined,
      conditionId: /^\d+$/.test(req.query.conditionId || '')
        ? Number(req.query.conditionId)
        : undefined,
      cityId: /^\d+$/.test(req.query.cityId || '') ? Number(req.query.cityId) : undefined,
      minPrice: /^\d+(\.\d+)?$/.test(req.query.minPrice || '')
        ? Number(req.query.minPrice)
        : undefined,
      maxPrice: /^\d+(\.\d+)?$/.test(req.query.maxPrice || '')
        ? Number(req.query.maxPrice)
        : undefined,
      exchangeOnly: req.query.exchangeOnly === '1',
      sort: typeof req.query.sort === 'string' ? req.query.sort : 'newest',
    };
    return res.render('pages/books', {
      title: 'Explore books',
      ...(await bookService.getCatalogData(search, filters)),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { show };
