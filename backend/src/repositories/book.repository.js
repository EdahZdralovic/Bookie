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
      ...(filters.conditionId ? { conditionId: filters.conditionId } : {}),
      owner: { status: 'ACTIVE', ...(filters.cityId ? { cityId: filters.cityId } : {}) },
      ...(filters.exchangeOnly ? { allowExchange: true } : {}),
      ...(filters.minPrice !== undefined || filters.maxPrice !== undefined
        ? {
            price: {
              ...(filters.minPrice !== undefined ? { gte: filters.minPrice } : {}),
              ...(filters.maxPrice !== undefined ? { lte: filters.maxPrice } : {}),
            },
          }
        : {}),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { author: { contains: search, mode: 'insensitive' } },
          { isbn: { contains: search, mode: 'insensitive' } },
          { genre: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    },
    include: publicBookInclude,
    orderBy:
      filters.sort === 'price-asc'
        ? { price: 'asc' }
        : filters.sort === 'price-desc'
          ? { price: 'desc' }
          : filters.sort === 'oldest'
            ? { createdAt: 'asc' }
            : { createdAt: 'desc' },
  });
}

async function findStatisticsByBookIds(bookIds, db = prisma) {
  if (bookIds.length === 0) return [];
  return db.$queryRaw`
    SELECT * FROM "BookStatistics" WHERE "bookId" IN (${Prisma.join(bookIds)})
  `;
}

async function findById(id, db = prisma) {
  return db.book.findUnique({
    where: { id },
    include: {
      ...publicBookInclude,
      orderItems: {
        where: { review: { isNot: null } },
        include: {
          review: true,
          order: {
            select: {
              buyer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
            },
          },
        },
      },
    },
  });
}
async function findBuyerExchangeBooks(userId, db = prisma) {
  return db.book.findMany({
    where: { ownerId: userId, allowExchange: true, status: 'ACTIVE' },
    select: { id: true, title: true, author: true },
    orderBy: { title: 'asc' },
  });
}

module.exports = { findActiveBooks, findStatisticsByBookIds, findById, findBuyerExchangeBooks };
