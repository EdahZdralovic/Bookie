const { UserRole, AccountStatus } = require('@prisma/client');

module.exports = Object.freeze({
  ROLES: UserRole,
  ACCOUNT_STATUS: AccountStatus,
  PUBLIC_ROLES: Object.freeze([UserRole.BUYER, UserRole.SELLER]),
  PASSWORD: Object.freeze({ MIN_LENGTH: 8, MAX_BYTES: 72, HASH_ROUNDS: 12 }),
  NAME_MAX_LENGTH: 80,
  EMAIL_MAX_LENGTH: 254,
  MAX_INTERESTS: 50,
  JWT_ALGORITHM: 'HS256',
  JWT_ISSUER: 'bookie',
  JWT_AUDIENCE: 'bookie-web',
  SESSION_SECONDS: 2 * 60 * 60,
  CSRF_BYTES: 32,
  RATE_WINDOW_MS: 15 * 60 * 1000,
  LOGIN_LIMIT: 10,
  REGISTER_LIMIT: 5,
  PATHS: Object.freeze({
    HOME: '/',
    LOGIN: '/login',
    REGISTER: '/register',
    LOGOUT: '/logout',
    ACCOUNT: '/account',
    ME: '/api/auth/me',
  }),
});
