const { Prisma } = require('@prisma/client');
const prisma = require('../config/database');

const publicBookInclude = {
  owner: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, city: true } },
  genre: true,
  language: true,
  condition: true,
  pickupLocations: { include: { city: true } },
  tags: { include: { tag: true } },
};

async function findActiveBooks(search = '', filters = {}, db = prisma) {
  return db.book.findMany({
    where: {
      status: 'ACTIVE',
      ...(filters.genreId ? { genreId: filters.genreId } : {}),
      ...(filters.languageId ? { languageId: filters.languageId } : {}),
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

async function findByPublicId(publicId, db = prisma) {
  return db.book.findUnique({ where: { publicId }, include: { ...publicBookInclude, orderItems: { where: { review: { isNot: null } }, include: { review: true, order: { select: { buyer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } } } } } } });
}

module.exports = { findActiveBooks, findStatisticsByBookIds, findByPublicId };
