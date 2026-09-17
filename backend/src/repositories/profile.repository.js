const prisma = require('../config/database');

function findProfile(userId, db = prisma) {
  return db.user.findUnique({
    where: { id: userId },
    include: {
      city: true,
      genreInterests: { include: { genre: true } },
      languageInterests: { include: { language: true } },
    },
  });
}

function findSellerBooks(userId, filters = {}, db = prisma) {
  const allowedStatuses = ['ACTIVE', 'SOLD', 'ARCHIVED'];
  const status = allowedStatuses.includes(filters.status) ? filters.status : undefined;
  const statusWhere =
    status === 'SOLD' ? { status: { in: ['SOLD', 'EXCHANGED'] } } : status ? { status } : {};
  const orderBy = {
    newest: { createdAt: 'desc' },
    price: { price: 'asc' },
    title: { title: 'asc' },
  }[filters.sort] || { createdAt: 'desc' };
  return db.book.findMany({
    where: { ownerId: userId, ...statusWhere },
    select: {
      id: true,
      publicId: true,
      title: true,
      author: true,
      price: true,
      status: true,
      imageUrl: true,
      createdAt: true,
      genre: { select: { name: true } },
    },
    orderBy,
  });
}
function findOwnedBooks(userId, db = prisma) {
  return db.book.findMany({
    where: { ownerId: userId },
    include: { genre: true, language: true, condition: true },
    orderBy: { createdAt: 'desc' },
  });
}
async function findPublicSeller(userId, db = prisma) {
  return db.user.findFirst({
    where: { id: userId, role: { in: ['SELLER', 'BUYER'] }, status: 'ACTIVE' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      bio: true,
      city: true,
      books: {
        where: { status: 'ACTIVE' },
        include: { genre: true, language: true },
        orderBy: { createdAt: 'desc' },
      },
      sellerOrders: {
        where: { status: 'COMPLETED' },
        select: { items: { select: { review: { select: { rating: true } } } } },
      },
    },
  });
}
function findExchangeBooks(userId, db = prisma) {
  return db.book.findMany({
    where: { ownerId: userId, allowExchange: true },
    include: { genre: true, language: true },
    orderBy: { createdAt: 'desc' },
  });
}
function findExchangeBook(userId, bookId, db = prisma) {
  return db.book.findFirst({ where: { id: bookId, ownerId: userId, allowExchange: true } });
}
function updateBook(userId, bookId, data, db = prisma) {
  return db.book.updateMany({
    where: {
      id: bookId,
      ownerId: userId,
      allowExchange: true,
      status: { in: ['ACTIVE', 'ARCHIVED'] },
    },
    data,
  });
}
function deleteBook(userId, bookId, db = prisma) {
  return db.book.deleteMany({
    where: { id: bookId, ownerId: userId, allowExchange: true, status: 'ARCHIVED' },
  });
}

async function updateProfile(userId, data, db = prisma) {
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { avatarUrl: data.avatarUrl, phone: data.phone, cityId: data.cityId, bio: data.bio },
    });
    await tx.userGenreInterest.deleteMany({ where: { userId } });
    await tx.userLanguageInterest.deleteMany({ where: { userId } });
    await tx.userGenreInterest.createMany({
      data: data.genreIds.map((genreId) => ({ userId, genreId })),
    });
    await tx.userLanguageInterest.createMany({
      data: data.languageIds.map((languageId) => ({ userId, languageId })),
    });
  });
  return findProfile(userId, db);
}

module.exports = {
  findProfile,
  findSellerBooks,
  findOwnedBooks,
  findPublicSeller,
  findExchangeBooks,
  findExchangeBook,
  updateBook,
  deleteBook,
  updateProfile,
};
