const bookService = require('../services/book.service');

async function showHome(req, res, next) {
  try {
    const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const filters = { genreId: /^\d+$/.test(req.query.genreId || '') ? Number(req.query.genreId) : undefined, languageId: /^\d+$/.test(req.query.languageId || '') ? Number(req.query.languageId) : undefined };
    const landingData = await bookService.getLandingData(search, filters);
    res.render('pages/home', { title: 'Bookie', ...landingData });
  } catch (error) {
    next(error);
  }
}

module.exports = { showHome };
