const bookService = require('../services/book.service');

async function showHome(req, res, next) {
  try {
    const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const landingData = await bookService.getLandingData(search);
    res.render('pages/home', { title: 'Bookie', ...landingData });
  } catch (error) {
    next(error);
  }
}

module.exports = { showHome };
