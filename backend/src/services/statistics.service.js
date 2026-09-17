const statisticsRepository = require('../repositories/statistics.repository');

async function getAdminStatistics() {
  return statisticsRepository.getMarketplaceCounts();
}

module.exports = { getAdminStatistics };
