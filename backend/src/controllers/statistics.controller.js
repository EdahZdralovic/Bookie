const statisticsService = require('../services/statistics.service');

async function show(req, res, next) {
  try {
    const statistics = await statisticsService.getAdminStatistics();
    return res.render('pages/statistics', { title: 'Statistics', statistics });
  } catch (error) {
    return next(error);
  }
}

module.exports = { show };
