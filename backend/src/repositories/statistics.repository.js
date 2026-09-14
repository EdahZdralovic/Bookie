const prisma = require('../config/database');

async function getMarketplaceCounts(db = prisma) {
  const [userCount, sellerCount, completedOrderCount] = await Promise.all([
    db.user.count({ where: { status: 'ACTIVE' } }),
    db.user.count({ where: { role: 'SELLER', status: 'ACTIVE' } }),
    db.order.count({ where: { status: 'COMPLETED' } }),
  ]);
  return { userCount, sellerCount, completedOrderCount };
}

module.exports = { getMarketplaceCounts };
