const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const prisma = require('../config/database');
const userRepository = require('../repositories/user.repository');
const sessionRepository = require('../repositories/session.repository');
const catalogRepository = require('../repositories/catalog.repository');
const { toPublicUser } = require('../models/user.model');
const { signToken, verifyToken, hashToken } = require('../utils/token');
const { createCode, hashCode } = require('../utils/verification');
const { sendVerificationEmail } = require('../utils/mailer');
const AUTH = require('../constants/auth');
const EXCEPTIONS = require('../constants/exceptions');
const HTTP = require('../constants/http');
const AppException = require('../exceptions/app.exception');

const dummyHash = bcrypt.hashSync(
  crypto.randomBytes(32).toString('hex'),
  AUTH.PASSWORD.HASH_ROUNDS,
);

async function requireActiveAccount(user, db = prisma) {
  if (!user) throw new AppException('INVALID_CREDENTIALS', HTTP.UNAUTHORIZED);
  if (
    user.status === AUTH.ACCOUNT_STATUS.BLOCKED &&
    user.blockedUntil &&
    user.blockedUntil <= new Date()
  ) {
    user = await userRepository.reactivateExpiredBlock(user.id, new Date(), db);
  }
  if (user.status === AUTH.ACCOUNT_STATUS.ACTIVE) return user;
  await sessionRepository.revokeForUser(user.id, db);
  const code = {
    [AUTH.ACCOUNT_STATUS.INACTIVE]: 'ACCOUNT_INACTIVE',
    [AUTH.ACCOUNT_STATUS.ARCHIVED]: 'ACCOUNT_ARCHIVED',
    [AUTH.ACCOUNT_STATUS.BLOCKED]: user.blockedUntil
      ? 'ACCOUNT_TEMPORARILY_BLOCKED'
      : 'ACCOUNT_BLOCKED',
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
  if (process.env.RESEND_API_KEY && !user.emailVerifiedAt)
    throw new AppException('EMAIL_NOT_VERIFIED', HTTP.FORBIDDEN);
  return issueSession(await requireActiveAccount(user));
}

async function register(data) {
  const passwordHash = await bcrypt.hash(data.password, AUTH.PASSWORD.HASH_ROUNDS);
  const verificationCode = createCode();
  try {
    const result = await prisma.$transaction(async (db) => {
      const options = await catalogRepository.findRegistrationOptions(db);
      const fields = {};
      if (!options.cities.some((city) => city.id === data.cityId))
        fields.cityId = EXCEPTIONS.INVALID_CITY;
      if (!data.genreIds.every((id) => options.genres.some((genre) => genre.id === id)))
        fields.genreIds = EXCEPTIONS.INVALID_INTERESTS;
      if (!data.languageIds.every((id) => options.languages.some((language) => language.id === id)))
        fields.languageIds = EXCEPTIONS.INVALID_INTERESTS;
      if (Object.keys(fields).length)
        throw new AppException('VALIDATION_FAILED', HTTP.UNPROCESSABLE, fields);
      const user = await userRepository.create(
        {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          passwordHash,
          role: data.role,
          cityId: data.cityId,
          genreInterests: { create: data.genreIds.map((genreId) => ({ genreId })) },
          languageInterests: { create: data.languageIds.map((languageId) => ({ languageId })) },
          cart: { create: {} },
          emailVerifiedAt: process.env.RESEND_API_KEY ? null : new Date(),
          verificationCodeHash: process.env.RESEND_API_KEY ? hashCode(verificationCode) : null,
          verificationCodeExpiresAt: process.env.RESEND_API_KEY
            ? new Date(Date.now() + 900000)
            : null,
          verificationCodeSentAt: process.env.RESEND_API_KEY ? new Date() : null,
        },
        db,
      );
      return process.env.RESEND_API_KEY
        ? { verificationRequired: true, email: user.email }
        : issueSession(user, db);
    });
    if (result.verificationRequired) {
      try {
        await sendVerificationEmail(result.email, verificationCode);
      } catch (error) {
        console.error('Verification email delivery failed:', error.message);
      }
    }
    return result;
  } catch (error) {
    if (error.code === 'P2002')
      throw new AppException('EMAIL_IN_USE', HTTP.CONFLICT, { email: EXCEPTIONS.EMAIL_IN_USE });
    throw error;
  }
}

async function verifyEmail(email, code) {
  const user = await userRepository.findByEmail(email);
  if (
    !user ||
    user.emailVerifiedAt ||
    user.verificationCodeHash !== hashCode(code) ||
    user.verificationCodeExpiresAt < new Date()
  )
    throw new AppException('EMAIL_VERIFICATION_INVALID', HTTP.UNPROCESSABLE);
  await userRepository.update(user.id, {
    emailVerifiedAt: new Date(),
    verificationCodeHash: null,
    verificationCodeExpiresAt: null,
  });
  return issueSession(await userRepository.findById(user.id));
}
async function resendVerification(email) {
  const user = await userRepository.findByEmail(email);
  if (!user || user.emailVerifiedAt) return { retryAfter: 0 };
  const now = Date.now();
  const sentAt = user.verificationCodeSentAt?.getTime() || 0;
  if (now - sentAt < 20000) return { retryAfter: Math.ceil((20000 - (now - sentAt)) / 1000) };
  const code = createCode();
  await userRepository.update(user.id, {
    verificationCodeHash: hashCode(code),
    verificationCodeExpiresAt: new Date(now + 900000),
    verificationCodeSentAt: new Date(now),
  });
  await sendVerificationEmail(email, code);
  return { retryAfter: 20 };
}

async function authenticate(token) {
  const payload = verifyToken(token);
  const session = await sessionRepository.findByHash(hashToken(token));
  if (!session || session.revokedAt || session.userId !== Number(payload.sub))
    throw new AppException('SESSION_REVOKED', HTTP.UNAUTHORIZED);
  if (session.expiresAt <= new Date()) throw new AppException('SESSION_EXPIRED', HTTP.UNAUTHORIZED);
  return toPublicUser(await requireActiveAccount(session.user));
}

async function logout(token) {
  if (typeof token === 'string' && token) await sessionRepository.revoke(hashToken(token));
}

const getRegistrationOptions = () => catalogRepository.findRegistrationOptions();

module.exports = {
  login,
  register,
  verifyEmail,
  resendVerification,
  authenticate,
  logout,
  getRegistrationOptions,
};
