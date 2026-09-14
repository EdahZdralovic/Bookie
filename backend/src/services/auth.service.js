const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const prisma = require('../config/database');
const userRepository = require('../repositories/user.repository');
const sessionRepository = require('../repositories/session.repository');
const catalogRepository = require('../repositories/catalog.repository');
const { toPublicUser } = require('../models/user.model');
const { signToken, verifyToken, hashToken } = require('../utils/token');
const AUTH = require('../constants/auth');
const EXCEPTIONS = require('../constants/exceptions');
const HTTP = require('../constants/http');
const AppException = require('../exceptions/app.exception');

const dummyHash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), AUTH.PASSWORD.HASH_ROUNDS);

async function requireActiveAccount(user, db = prisma) {
  if (!user) throw new AppException('INVALID_CREDENTIALS', HTTP.UNAUTHORIZED);
  if (user.status === AUTH.ACCOUNT_STATUS.BLOCKED && user.blockedUntil && user.blockedUntil <= new Date()) {
    user = await userRepository.reactivateExpiredBlock(user.id, new Date(), db);
  }
  if (user.status === AUTH.ACCOUNT_STATUS.ACTIVE) return user;
  await sessionRepository.revokeForUser(user.id, db);
  const code = {
    [AUTH.ACCOUNT_STATUS.INACTIVE]: 'ACCOUNT_INACTIVE',
    [AUTH.ACCOUNT_STATUS.ARCHIVED]: 'ACCOUNT_ARCHIVED',
    [AUTH.ACCOUNT_STATUS.BLOCKED]: user.blockedUntil ? 'ACCOUNT_TEMPORARILY_BLOCKED' : 'ACCOUNT_BLOCKED',
  }[user.status];
  throw new AppException(code || 'FORBIDDEN', HTTP.FORBIDDEN);
}

async function issueSession(user, db = prisma) {
  const { token, tokenHash, expiresAt } = signToken(user.id);
  await sessionRepository.create({ userId: user.id, tokenHash, expiresAt }, db);
  return { token, user: toPublicUser(user) };
}

async function login({ email, password }) {
  const user = await userRepository.findByEmail(email);
  const valid = await bcrypt.compare(password, user?.passwordHash || dummyHash);
  if (!user || !valid) throw new AppException('INVALID_CREDENTIALS', HTTP.UNAUTHORIZED);
  return issueSession(await requireActiveAccount(user));
}

async function register(data) {
  const passwordHash = await bcrypt.hash(data.password, AUTH.PASSWORD.HASH_ROUNDS);
  try {
    return await prisma.$transaction(async (db) => {
      const options = await catalogRepository.findRegistrationOptions(db);
      const fields = {};
      if (!options.cities.some((city) => city.id === data.cityId)) fields.cityId = EXCEPTIONS.INVALID_CITY;
      if (!data.genreIds.every((id) => options.genres.some((genre) => genre.id === id))) fields.genreIds = EXCEPTIONS.INVALID_INTERESTS;
      if (!data.languageIds.every((id) => options.languages.some((language) => language.id === id))) fields.languageIds = EXCEPTIONS.INVALID_INTERESTS;
      if (Object.keys(fields).length) throw new AppException('VALIDATION_FAILED', HTTP.UNPROCESSABLE, fields);
      const user = await userRepository.create({
        firstName: data.firstName, lastName: data.lastName, email: data.email,
        passwordHash, role: data.role, cityId: data.cityId,
        genreInterests: { create: data.genreIds.map((genreId) => ({ genreId })) },
        languageInterests: { create: data.languageIds.map((languageId) => ({ languageId })) },
        cart: { create: {} },
      }, db);
      return issueSession(user, db);
    });
  } catch (error) {
    if (error.code === 'P2002') throw new AppException('EMAIL_IN_USE', HTTP.CONFLICT, { email: EXCEPTIONS.EMAIL_IN_USE });
    throw error;
  }
}

async function authenticate(token) {
  const payload = verifyToken(token);
  const session = await sessionRepository.findByHash(hashToken(token));
  if (!session || session.revokedAt || session.userId !== Number(payload.sub)) throw new AppException('SESSION_REVOKED', HTTP.UNAUTHORIZED);
  if (session.expiresAt <= new Date()) throw new AppException('SESSION_EXPIRED', HTTP.UNAUTHORIZED);
  return toPublicUser(await requireActiveAccount(session.user));
}

async function logout(token) {
  if (typeof token === 'string' && token) await sessionRepository.revoke(hashToken(token));
}

const getRegistrationOptions = () => catalogRepository.findRegistrationOptions();

module.exports = { login, register, authenticate, logout, getRegistrationOptions };
