const prisma = require('../config/database');

async function createBook(data, db = prisma) {
  return db.book.create({ data, include: { genre: true, language: true, condition: true, pickupLocations: { include: { city: true } } } });
}

module.exports = { createBook };
