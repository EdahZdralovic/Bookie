const prisma = require('../config/database');

async function findActiveGenres(db = prisma) {
  return db.genre.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
}

async function findRegistrationOptions(db = prisma) {
  const [cities, genres, languages] = await Promise.all([
    db.city.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    findActiveGenres(db),
    db.language.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
  ]);
  return { cities, genres, languages };
}

module.exports = { findActiveGenres, findRegistrationOptions };
