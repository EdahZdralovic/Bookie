const prisma = require('../config/database');

const create = (data, db = prisma) => db.session.create({ data });
const findByHash = (tokenHash, db = prisma) => db.session.findUnique({ where: { tokenHash }, include: { user: { include: { city: true } } } });
const revoke = (tokenHash, db = prisma) => db.session.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
const revokeForUser = (userId, db = prisma) => db.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });

module.exports = { create, findByHash, revoke, revokeForUser };
