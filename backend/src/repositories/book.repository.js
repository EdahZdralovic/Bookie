const { Prisma } = require('@prisma/client');
const prisma = require('../config/database');

const publicBookInclude = {
  owner: { select: { id: true, firstName: true, lastName: true, city: true } },
  genre: true,
  language: true,
  condition: true,
  pickupLocations: { include: { city: true } },
  tags: { include: { tag: true } },
};

async function findActiveBooks(search = '', db = prisma) {
  return db.book.findMany({
    where: {
      status: 'ACTIVE',
      ...(search && {
        OR: [
          { title: { contains: search } },
          { author: { contains: search } },
          { isbn: { contains: search } },
          { genre: { name: { contains: search } } },
        ],
      }),
    },
    include: publicBookInclude,
    orderBy: { createdAt: 'desc' },
  });
}

async function findStatisticsByBookIds(bookIds, db = prisma) {
  if (bookIds.length === 0) return [];
  return db.$queryRaw`
    SELECT * FROM "BookStatistics" WHERE "bookId" IN (${Prisma.join(bookIds)})
  `;
}

module.exports = { findActiveBooks, findStatisticsByBookIds };
