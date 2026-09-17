const prisma = require('../config/database');

async function getMarketplaceCounts(db = prisma) {
  const activeUsers = { status: 'ACTIVE' };
  const [
    userCount,
    sellerCount,
    buyerCount,
    totalBookCount,
    activeBookCount,
    completedOrderCount,
    sellerCountForAverage,
    sellerBookGroups,
    genreGroups,
    languageGroups,
    completedOrders,
  ] = await Promise.all([
    db.user.count({ where: activeUsers }),
    db.user.count({ where: { ...activeUsers, role: 'SELLER' } }),
    db.user.count({ where: { ...activeUsers, role: 'BUYER' } }),
    db.book.count(),
    db.book.count({ where: { status: 'ACTIVE' } }),
    db.order.count({ where: { status: 'COMPLETED' } }),
    db.user.count({ where: { ...activeUsers, role: 'SELLER' } }),
    db.book.groupBy({ by: ['ownerId'], _count: { _all: true } }),
    db.book.groupBy({
      by: ['genreId'],
      where: { status: { not: 'ARCHIVED' } },
      _count: { _all: true },
      orderBy: { _count: { genreId: 'desc' } },
      take: 5,
    }),
    db.book.groupBy({
      by: ['languageId'],
      where: { status: { not: 'ARCHIVED' } },
      _count: { _all: true },
      orderBy: { _count: { languageId: 'desc' } },
    }),
    db.order.findMany({
      where: { status: 'COMPLETED' },
      select: { type: true, completedAt: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  const genres = await Promise.all(
    genreGroups.map(async (group) => ({
      name:
        (await db.genre.findUnique({ where: { id: group.genreId }, select: { name: true } }))
          ?.name || 'Unknown',
      count: group._count._all,
    })),
  );
  const averageBooksPerSeller = sellerCountForAverage
    ? sellerBookGroups.reduce((sum, group) => sum + group._count._all, 0) / sellerCountForAverage
    : 0;
  const languages = await Promise.all(
    languageGroups.map(async (group) => ({
      name:
        (await db.language.findUnique({ where: { id: group.languageId }, select: { name: true } }))
          ?.name || 'Unknown',
      count: group._count._all,
    })),
  );
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - (11 - index));
    return {
      key: `${date.getUTCFullYear()}-${date.getUTCMonth()}`,
      label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
      sold: 0,
      exchanged: 0,
    };
  });
  const monthMap = new Map(months.map((month) => [month.key, month]));
  completedOrders.forEach((order) => {
    const date = order.completedAt || order.createdAt;
    const month = monthMap.get(`${date.getUTCFullYear()}-${date.getUTCMonth()}`);
    if (month) month[order.type === 'EXCHANGE' ? 'exchanged' : 'sold'] += 1;
  });
  return {
    userCount,
    sellerCount,
    buyerCount,
    totalBookCount,
    activeBookCount,
    completedOrderCount,
    averageBooksPerSeller,
    popularGenres: genres,
    languages,
    monthlyCompleted: months,
  };
}

module.exports = { getMarketplaceCounts };
