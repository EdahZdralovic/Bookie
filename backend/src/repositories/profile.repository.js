const prisma = require('../config/database');

function findProfile(userId, db = prisma) {
  return db.user.findUnique({ where: { id: userId }, include: { city: true, genreInterests: true, languageInterests: true } });
}

function findSellerBooks(userId, filters = {}, db = prisma) {
  const allowedStatuses = ['ACTIVE', 'SOLD', 'ARCHIVED'];
  const status = allowedStatuses.includes(filters.status) ? filters.status : undefined;
  const statusWhere = status === 'SOLD' ? { status: { in: ['SOLD', 'EXCHANGED'] } } : status ? { status } : {};
  const orderBy = { newest: { createdAt: 'desc' }, price: { price: 'asc' }, title: { title: 'asc' } }[filters.sort] || { createdAt: 'desc' };
  return db.book.findMany({ where: { ownerId: userId, ...statusWhere }, select: { id: true, publicId: true, title: true, author: true, price: true, status: true, imageUrl: true, createdAt: true, genre: { select: { name: true } } }, orderBy });
}

async function updateProfile(userId, data, db = prisma) {
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { avatarUrl: data.avatarUrl } });
    await tx.userGenreInterest.deleteMany({ where: { userId } });
    await tx.userLanguageInterest.deleteMany({ where: { userId } });
    await tx.userGenreInterest.createMany({ data: data.genreIds.map((genreId) => ({ userId, genreId })) });
    await tx.userLanguageInterest.createMany({ data: data.languageIds.map((languageId) => ({ userId, languageId })) });
  });
  return findProfile(userId, db);
}

module.exports = { findProfile, findSellerBooks, updateProfile };
