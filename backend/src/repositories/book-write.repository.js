const prisma = require('../config/database');

async function createBook(data, db = prisma) {
  return db.book.create({
    data,
    include: {
      genre: true,
      language: true,
      condition: true,
      pickupLocations: { include: { city: true } },
    },
  });
}
async function findOwnedBook(userId, bookId, db = prisma) {
  return db.book.findFirst({
    where: { id: bookId, ownerId: userId },
    include: { pickupLocations: true },
  });
}
async function updateOwnedBook(userId, bookId, data, db = prisma) {
  return db.book.update({ where: { id: bookId }, data });
}
async function archiveOwnedBook(userId, bookId, db = prisma) {
  return db.book.updateMany({
    where: { id: bookId, ownerId: userId, status: 'ACTIVE' },
    data: { status: 'ARCHIVED' },
  });
}
async function deleteArchivedBook(userId, bookId, db = prisma) {
  return db.book.deleteMany({ where: { id: bookId, ownerId: userId, status: 'ARCHIVED' } });
}

module.exports = {
  createBook,
  findOwnedBook,
  updateOwnedBook,
  archiveOwnedBook,
  deleteArchivedBook,
};
