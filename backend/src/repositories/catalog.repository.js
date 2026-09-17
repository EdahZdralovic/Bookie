const prisma = require('../config/database');

async function findActiveGenres(db = prisma) {
  return db.genre.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
}
function findActiveLanguages(db = prisma) {
  return db.language.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
}

async function findRegistrationOptions(db = prisma) {
  const [cities, genres, languages] = await Promise.all([
    db.city.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    findActiveGenres(db),
    db.language.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
  ]);
  return { cities, genres, languages };
}

async function findBookOptions(db = prisma) {
  const [cities, genres, languages, conditions] = await Promise.all([
    db.city.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    db.genre.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    db.language.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    db.bookCondition.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
  ]);
  return { cities, genres, languages, conditions };
}

module.exports = {
  findActiveGenres,
  findActiveLanguages,
  findRegistrationOptions,
  findBookOptions,
};
