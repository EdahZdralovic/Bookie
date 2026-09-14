const prisma = require('../config/database');
const { ACCOUNT_STATUS } = require('../constants/auth');

const findByEmail = (email, db = prisma) => db.user.findUnique({ where: { email }, include: { city: true } });
const findById = (id, db = prisma) => db.user.findUnique({ where: { id }, include: { city: true } });
const create = (data, db = prisma) => db.user.create({ data, include: { city: true } });

async function reactivateExpiredBlock(userId, now, db = prisma) {
  await db.user.updateMany({
    where: { id: userId, status: ACCOUNT_STATUS.BLOCKED, blockedUntil: { lte: now } },
    data: { status: ACCOUNT_STATUS.ACTIVE, blockedUntil: null },
  });
  return findById(userId, db);
}

module.exports = { findByEmail, findById, create, reactivateExpiredBlock };
