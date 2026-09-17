const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
require('dotenv').config({ quiet: true });
process.env.RESEND_API_KEY = '';
process.env.RESEND_FROM_EMAIL = '';
const { PrismaClient, Prisma } = require('@prisma/client');

const root = path.resolve(__dirname, '..');
const databaseName = `bookie_test_${process.pid}_${Date.now()}`;
const sourceUrl = new URL(process.env.DATABASE_URL);
const adminUrl = new URL(sourceUrl);
adminUrl.pathname = '/postgres';
const testUrl = new URL(sourceUrl);
testUrl.pathname = `/${databaseName}`;
testUrl.searchParams.set('schema', 'public');
const admin = new PrismaClient({ datasources: { db: { url: adminUrl.href } } });
const db = new PrismaClient({ datasources: { db: { url: testUrl.href } } });
let created = false;
let fixtures;
let appDatabase;
const rollbackSignal = new Error('ROLLBACK_TEST');
async function rollback(work) {
  try {
    await db.$transaction(async (tx) => {
      await work(tx);
      throw rollbackSignal;
    });
  } catch (error) {
    if (error !== rollbackSignal) throw error;
  }
}
function migrate(...args) {
  return execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), ...args], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: testUrl.href },
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

before(
  async () => {
    assert.match(databaseName, /^bookie_test_\d+_\d+$/);
    await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    created = true;
    migrate('migrate', 'deploy');
    process.env.DATABASE_URL = testUrl.href;
    const { seedDatabase } = require('../prisma/seed');
    await seedDatabase(db);
    fixtures = {
      buyer: await db.user.findUniqueOrThrow({ where: { email: 'student@bookie.test' } }),
      seller: await db.user.findUniqueOrThrow({ where: { email: 'prodavac@bookie.ba' } }),
      admin: await db.user.findUniqueOrThrow({ where: { email: 'admin@bookie.ba' } }),
      book: await db.book.findUniqueOrThrow({ where: { publicId: 'demo-clean-code' } }),
      sale: await db.order.findUniqueOrThrow({
        where: { orderNumber: 'BK-DEMO-001' },
        include: { items: true },
      }),
      exchange: await db.order.findUniqueOrThrow({ where: { orderNumber: 'BK-DEMO-002' } }),
      pending: await db.order.findUniqueOrThrow({
        where: { orderNumber: 'BK-DEMO-003' },
        include: { items: true },
      }),
    };
  },
  { timeout: 60000 },
);

after(async () => {
  if (appDatabase) await appDatabase.$disconnect();
  await db.$disconnect();
  if (created) await admin.$executeRawUnsafe(`DROP DATABASE "${databaseName}"`);
  await admin.$disconnect();
});

test('fresh migrations create every English-named model and both statistics views', async () => {
  const tables =
    await db.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'`;
  const modelNames = Prisma.dmmf.datamodel.models.map((model) => model.name).sort();
  assert.equal(modelNames.length, 33);
  assert.deepEqual(tables.map((row) => row.table_name).sort(), modelNames);
  const columns =
    await db.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'`;
  for (const { column_name } of columns) assert.match(column_name, /^[A-Za-z][A-Za-z0-9]*$/);
  const views =
    await db.$queryRaw`SELECT table_name FROM information_schema.views WHERE table_schema = 'public'`;
  assert.deepEqual(views.map((row) => row.table_name).sort(), [
    'BookStatistics',
    'SellerStatistics',
  ]);
  const documentation = fs.readFileSync(path.join(root, '../docs/database.md'), 'utf8');
  for (const name of modelNames)
    assert.ok(documentation.includes(`\`${name}\``), `${name} missing from database documentation`);
});

test('migration replay is a no-op and the schema has no drift', () => {
  assert.match(migrate('migrate', 'deploy'), /No pending migrations/);
  migrate(
    'migrate',
    'diff',
    '--from-schema-datasource',
    'prisma/schema.prisma',
    '--to-schema-datamodel',
    'prisma/schema.prisma',
    '--exit-code',
  );
});

test('seed reruns preserve counts, edited passwords and moderated users', async () => {
  const counts = async () =>
    Promise.all(
      Prisma.dmmf.datamodel.models.map((model) =>
        db[model.name[0].toLowerCase() + model.name.slice(1)].count(),
      ),
    );
  const initial = await counts();
  await db.user.update({
    where: { id: fixtures.buyer.id },
    data: { status: 'BLOCKED', passwordHash: 'test-preserved-hash' },
  });
  await require('../prisma/seed').seedDatabase(db);
  assert.deepEqual(await counts(), initial);
  const user = await db.user.findUniqueOrThrow({ where: { id: fixtures.buyer.id } });
  assert.equal(user.status, 'BLOCKED');
  assert.equal(user.passwordHash, 'test-preserved-hash');
  await db.user.update({
    where: { id: user.id },
    data: { status: fixtures.buyer.status, passwordHash: fixtures.buyer.passwordHash },
  });
});

test('required book details and money constraints reject invalid rows', async () => {
  for (const data of [
    { price: '-0.01' },
    { price: '0.00', allowExchange: false },
    { title: ' ' },
    { publicationYear: 0 },
  ]) {
    await assert.rejects(
      rollback((tx) => tx.book.update({ where: { id: fixtures.book.id }, data })),
      /constraint/i,
    );
  }
  await assert.rejects(
    rollback(
      (tx) => tx.$executeRaw`UPDATE "Book" SET "genreId" = NULL WHERE id = ${fixtures.book.id}`,
    ),
    /null/i,
  );
  await rollback(async (tx) => {
    const book = await tx.book.update({
      where: { id: fixtures.book.id },
      data: { price: '19.99' },
    });
    assert.equal(book.price.toFixed(2), '19.99');
  });
});

test('legacy enums, duplicate email, mixed-case email and inconsistent account states are rejected', async () => {
  await assert.rejects(
    rollback(
      (tx) => tx.$executeRaw`UPDATE "User" SET role = 'STUDENT' WHERE id = ${fixtures.buyer.id}`,
    ),
    /enum/i,
  );
  await assert.rejects(
    rollback(
      (tx) => tx.$executeRaw`UPDATE "Book" SET status = 'AVAILABLE' WHERE id = ${fixtures.book.id}`,
    ),
    /enum/i,
  );
  for (const data of [
    { email: fixtures.seller.email },
    { email: 'Mixed@Example.com' },
    { status: 'ARCHIVED' },
    { blockedUntil: new Date() },
  ]) {
    await assert.rejects(
      rollback((tx) => tx.user.update({ where: { id: fixtures.buyer.id }, data })),
    );
  }
  await rollback((tx) =>
    tx.user.update({
      where: { id: fixtures.buyer.id },
      data: { status: 'BLOCKED', blockedUntil: new Date(Date.now() + 15 * 86400000) },
    }),
  );
  await rollback((tx) =>
    tx.user.update({
      where: { id: fixtures.buyer.id },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    }),
  );
});

test('sessions store only hashes and require valid expiry', async () => {
  const base = {
    userId: fixtures.buyer.id,
    tokenHash: 'a'.repeat(64),
    expiresAt: new Date(Date.now() + 3600000),
  };
  await rollback((tx) => tx.session.create({ data: base }));
  await assert.rejects(
    rollback((tx) => tx.session.create({ data: { ...base, tokenHash: 'raw-token' } })),
    /constraint/i,
  );
  await assert.rejects(
    rollback((tx) => tx.session.create({ data: { ...base, expiresAt: new Date(0) } })),
    /constraint/i,
  );
});

test('orders reject self-purchase, invalid amounts and inconsistent status timestamps', async () => {
  for (const data of [
    { buyerId: fixtures.seller.id },
    { totalAmount: '0.00' },
    { status: 'COMPLETED' },
    { currency: 'USD' },
  ]) {
    await assert.rejects(
      rollback((tx) => tx.order.update({ where: { id: fixtures.pending.id }, data })),
      /constraint/i,
    );
  }
  await assert.rejects(
    rollback((tx) =>
      tx.order.update({ where: { id: fixtures.exchange.id }, data: { totalAmount: '1.00' } }),
    ),
    /constraint/i,
  );
});

test('one physical book cannot be reserved by two concurrent orders', async () => {
  const bookId = fixtures.book.id;
  const results = await Promise.allSettled([
    db.bookReservation.create({ data: { bookId, orderId: fixtures.exchange.id } }),
    db.bookReservation.create({ data: { bookId, orderId: fixtures.pending.id } }),
  ]);
  try {
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
    assert.equal(await db.bookReservation.count({ where: { bookId } }), 1);
  } finally {
    await db.bookReservation.deleteMany({ where: { bookId } });
  }
});

test('review eligibility, range and one-review-per-order-item are enforced', async () => {
  const data = {
    orderItemId: fixtures.pending.items[0].id,
    rating: 5,
    editableUntil: new Date(Date.now() + 86400000),
  };
  await assert.rejects(
    rollback((tx) => tx.review.create({ data })),
    /completed order/i,
  );
  await assert.rejects(
    rollback((tx) =>
      tx.review.create({ data: { ...data, orderItemId: fixtures.sale.items[0].id } }),
    ),
    /unique/i,
  );
  const review = await db.review.findUniqueOrThrow({
    where: { orderItemId: fixtures.sale.items[0].id },
  });
  for (const rating of [0, 6])
    await assert.rejects(
      rollback((tx) => tx.review.update({ where: { id: review.id }, data: { rating } })),
      /constraint/i,
    );
});

test('statistics derive from reviews and completed records, including both exchange sides', async () => {
  const soldId = fixtures.sale.items[0].bookId;
  const [sold] = await db.$queryRaw`SELECT * FROM "BookStatistics" WHERE "bookId" = ${soldId}`;
  assert.equal(sold.completedOrderCount, 1);
  assert.equal(sold.ratingCount, 1);
  assert.equal(sold.averageRating, 5);
  await rollback(async (tx) => {
    await tx.review.update({
      where: { orderItemId: fixtures.sale.items[0].id },
      data: { rating: 3 },
    });
    const [stats] = await tx.$queryRaw`SELECT * FROM "BookStatistics" WHERE "bookId" = ${soldId}`;
    assert.equal(stats.averageRating, 3);
    await tx.review.delete({ where: { orderItemId: fixtures.sale.items[0].id } });
    const [empty] = await tx.$queryRaw`SELECT * FROM "BookStatistics" WHERE "bookId" = ${soldId}`;
    assert.equal(empty.ratingCount, 0);
    assert.equal(empty.averageRating, 0);
    await tx.order.update({
      where: { id: fixtures.exchange.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    const exchangeBooks = await tx.book.findMany({
      where: { publicId: { in: ['demo-exchange-requested', 'demo-exchange-offered'] } },
    });
    for (const book of exchangeBooks) {
      const [result] =
        await tx.$queryRaw`SELECT * FROM "BookStatistics" WHERE "bookId" = ${book.id}`;
      assert.equal(result.completedOrderCount, 1);
    }
  });
});

test('message sender must belong to the conversation and body must be nonempty', async () => {
  const conversation = await db.conversation.findFirstOrThrow({
    where: { orderId: fixtures.exchange.id },
  });
  const data = {
    conversationId: conversation.id,
    senderId: fixtures.admin.id,
    body: 'Not a member',
  };
  await assert.rejects(
    rollback((tx) => tx.message.create({ data })),
    /foreign key/i,
  );
  await assert.rejects(
    rollback((tx) =>
      tx.message.create({ data: { ...data, senderId: fixtures.buyer.id, body: ' ' } }),
    ),
    /constraint/i,
  );
});

test('reports require exactly one target and complete resolution data', async () => {
  const data = { reporterId: fixtures.buyer.id, reason: 'Test' };
  for (const extra of [
    {},
    { bookId: fixtures.book.id, reportedUserId: fixtures.seller.id },
    { bookId: fixtures.book.id, status: 'RESOLVED' },
  ]) {
    await assert.rejects(
      rollback((tx) => tx.report.create({ data: { ...data, ...extra } })),
      /constraint/i,
    );
  }
  await rollback((tx) =>
    tx.report.create({ data: { ...data, reportedUserId: fixtures.seller.id } }),
  );
});

test('wishlist criteria and match uniqueness prevent empty or duplicate alerts', async () => {
  await assert.rejects(
    rollback((tx) => tx.wishlistAlert.create({ data: { userId: fixtures.buyer.id } })),
    /constraint/i,
  );
  const match = await db.wishlistMatch.findFirstOrThrow();
  await assert.rejects(
    rollback((tx) =>
      tx.wishlistMatch.create({
        data: { wishlistAlertId: match.wishlistAlertId, bookId: match.bookId },
      }),
    ),
    /unique/i,
  );
});

test('lookup and historical order deletion cannot erase referenced data', async () => {
  await assert.rejects(
    rollback((tx) => tx.genre.delete({ where: { id: fixtures.book.genreId } })),
    /foreign key/i,
  );
  await assert.rejects(
    rollback((tx) => tx.order.delete({ where: { id: fixtures.sale.id } })),
    /foreign key/i,
  );
  await assert.rejects(
    rollback((tx) => tx.book.delete({ where: { id: fixtures.sale.items[0].bookId } })),
    /foreign key/i,
  );
  await assert.rejects(
    rollback((tx) => tx.user.delete({ where: { id: fixtures.seller.id } })),
    /foreign key/i,
  );
});

test('homepage remains compatible with normalized PostgreSQL data', async () => {
  const { getLandingData } = require('../src/services/book.service');
  appDatabase = require('../src/config/database');
  const data = await getLandingData();
  assert.ok(data.popularBooks.length > 0);
  for (const book of data.popularBooks) {
    assert.equal(typeof book.averageRating, 'number');
    assert.equal(typeof book.price, 'number');
    assert.equal(book.owner.passwordHash, undefined);
  }
  const ejs = require('ejs');
  const html = await ejs.renderFile(path.join(root, '../frontend/views/pages/home.ejs'), {
    title: 'Bookie',
    ...data,
    currentUser: null,
    csrfToken: '',
    auth: require('../src/constants/auth'),
    authText: require('../src/constants/auth-text'),
  });
  assert.match(html, /Bookie/);
});

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { beforeEach } = require('node:test');
const { ipKeyGenerator } = require('express-rate-limit');
const EXCEPTIONS = require('../src/constants/exceptions');
let app;

beforeEach(() => {
  app = require('../src/app');
  appDatabase = require('../src/config/database');
  const { loginLimiter, registerLimiter } = require('../src/middleware/rate-limit.middleware');
  for (const limiter of [loginLimiter, registerLimiter]) {
    for (const ip of ['127.0.0.1', '::ffff:127.0.0.1', '::1']) limiter.resetKey(ipKeyGenerator(ip));
  }
});

function csrfFrom(html) {
  const token = html.match(/name="_csrf" value="([a-f0-9.]+)"/);
  assert.ok(token);
  return token[1];
}

async function authAgent(page = '/login') {
  const agent = request.agent(app);
  const response = await agent.get(page).expect(200);
  return { agent, csrf: csrfFrom(response.text), html: response.text };
}

async function registrationData() {
  const [city, genre, language] = await Promise.all([
    db.city.findFirstOrThrow(),
    db.genre.findFirstOrThrow(),
    db.language.findFirstOrThrow(),
  ]);
  return {
    phone: '+38761000000',
    firstName: 'Test',
    lastName: 'Reader',
    email: `reader-${Date.now()}@example.test`,
    password: 'Reading123',
    repeatPassword: 'Reading123',
    role: 'BUYER',
    cityId: String(city.id),
    genreIds: [String(genre.id)],
    languageIds: [String(language.id)],
  };
}

async function loggedInAgent() {
  const { agent, csrf } = await authAgent();
  const response = await agent
    .post('/login')
    .type('form')
    .send({ email: fixtures.buyer.email, password: 'student123', _csrf: csrf })
    .expect(303);
  return { agent, response };
}

test('auth forms render required constraints and protect the account page', async () => {
  const { html } = await authAgent('/register');
  assert.match(html, /name="repeatPassword"/);
  assert.match(html, /data-rule="uppercase"/);
  assert.match(html, /data-rule="number"/);
  assert.doesNotMatch(html, /name="password"[^>]*value=/);
  await request(app).get('/account').expect(401);
  const response = await request(app).get('/api/auth/me').expect(401);
  assert.equal(response.body.error.message, EXCEPTIONS.AUTH_REQUIRED);
});

test('registration reports all missing fields on the server', async () => {
  const { agent, csrf } = await authAgent('/register');
  const response = await agent.post('/register').send({ _csrf: csrf }).expect(422);
  assert.deepEqual(
    Object.keys(response.body.error.fields).sort(),
    [
      'firstName',
      'lastName',
      'email',
      'phone',
      'password',
      'repeatPassword',
      'role',
      'cityId',
      'genreIds',
      'languageIds',
    ].sort(),
  );
});

test('weak and mismatched passwords return constants without echoing passwords', async () => {
  const { agent, csrf } = await authAgent('/register');
  const data = {
    ...(await registrationData()),
    password: 'weak',
    repeatPassword: 'different',
    _csrf: csrf,
  };
  const response = await agent.post('/register').send(data).expect(422);
  assert.equal(response.body.error.fields.password, EXCEPTIONS.WEAK_PASSWORD);
  assert.equal(response.body.error.fields.repeatPassword, EXCEPTIONS.PASSWORD_MISMATCH);
  const html = await agent.post('/register').type('form').send(data).expect(422);
  assert.match(html.text, /value="Test"/);
  assert.doesNotMatch(html.text, /value="weak"|value="different"/);
});

test('registration rejects admin roles, invalid lookups and oversized or malformed values', async () => {
  const { agent, csrf } = await authAgent('/register');
  const data = { ...(await registrationData()), _csrf: csrf };
  const cases = [
    [{ role: 'ADMIN' }, 'role', EXCEPTIONS.INVALID_ROLE],
    [{ cityId: '999999999' }, 'cityId', EXCEPTIONS.INVALID_CITY],
    [{ password: `A1${'š'.repeat(36)}` }, 'password', EXCEPTIONS.PASSWORD_TOO_LONG],
    [{ genreIds: [{ id: 1 }] }, 'genreIds', EXCEPTIONS.INVALID_INTERESTS],
  ];
  for (const [values, field, message] of cases) {
    const response = await agent
      .post('/register')
      .send({ ...data, ...values })
      .expect(422);
    assert.equal(response.body.error.fields[field], message);
  }
});

test('registration creates user, interests, cart and a hashed revocable JWT session', async () => {
  const { agent, csrf } = await authAgent('/register');
  const data = await registrationData();
  data.email = `  ${data.email.toUpperCase()}  `;
  const response = await agent
    .post('/register')
    .type('form')
    .send({ ...data, _csrf: csrf })
    .expect(303);
  assert.equal(response.headers.location, '/account');
  const user = await db.user.findUniqueOrThrow({
    where: { email: data.email.trim().toLowerCase() },
    include: { sessions: true, cart: true, genreInterests: true, languageInterests: true },
  });
  assert.ok(await require('bcryptjs').compare(data.password, user.passwordHash));
  assert.equal(user.role, 'BUYER');
  assert.equal(user.genreInterests.length, 1);
  assert.equal(user.languageInterests.length, 1);
  assert.ok(user.cart);
  const cookie = response.headers['set-cookie'].find((item) => item.startsWith('bookie_token='));
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  const token = cookie.split(';')[0].split('=')[1];
  assert.equal(user.sessions[0].tokenHash, require('../src/utils/token').hashToken(token));
  assert.equal(jwt.decode(token).sub, String(user.id));
  assert.equal(jwt.decode(token).password, undefined);
  const me = await agent.get('/api/auth/me').expect(200);
  assert.equal(me.body.user.id, user.id);
  assert.equal(me.body.user.passwordHash, undefined);
  await agent.get('/account').expect(200);
  await agent.get('/login').expect(303);
});

test('duplicate registration does not create partial records', async () => {
  const { agent, csrf } = await authAgent('/register');
  const count = await db.user.count();
  const response = await agent
    .post('/register')
    .send({ ...(await registrationData()), email: 'STUDENT@BOOKIE.TEST', _csrf: csrf })
    .expect(409);
  assert.equal(response.body.error.fields.email, EXCEPTIONS.EMAIL_IN_USE);
  assert.equal(await db.user.count(), count);
});

test('unknown email and incorrect password share the same error', async () => {
  const { agent, csrf } = await authAgent();
  const missing = await agent
    .post('/login')
    .send({ email: 'missing@example.test', password: 'Reading123', _csrf: csrf })
    .expect(401);
  const wrong = await agent
    .post('/login')
    .send({ email: fixtures.buyer.email, password: 'incorrect', _csrf: csrf })
    .expect(401);
  assert.deepEqual(missing.body, wrong.body);
  assert.equal(missing.body.error.message, EXCEPTIONS.INVALID_CREDENTIALS);
});

test('logout revokes the JWT and rejects replay', async () => {
  const { agent, response } = await loggedInAgent();
  const cookie = response.headers['set-cookie']
    .find((item) => item.startsWith('bookie_token='))
    .split(';')[0];
  const account = await agent.get('/account').expect(200);
  await agent
    .post('/logout')
    .type('form')
    .send({ _csrf: csrfFrom(account.text) })
    .expect(303);
  await agent.get('/api/auth/me').expect(401);
  const replay = await request(app).get('/api/auth/me').set('Cookie', cookie).expect(401);
  assert.equal(replay.body.error.message, EXCEPTIONS.SESSION_REVOKED);
});

test('tampered, expired and wrongly targeted JWTs are rejected', async () => {
  const config = require('../src/config/auth');
  const AUTH = require('../src/constants/auth');
  const options = {
    subject: String(fixtures.buyer.id),
    issuer: AUTH.JWT_ISSUER,
    audience: AUTH.JWT_AUDIENCE,
    jwtid: 'test',
    expiresIn: 60,
  };
  const cases = [
    ['invalid.jwt.token', EXCEPTIONS.INVALID_TOKEN],
    [jwt.sign({}, config.secret, { ...options, expiresIn: -1 }), EXCEPTIONS.SESSION_EXPIRED],
    [jwt.sign({}, config.secret, { ...options, audience: 'other-app' }), EXCEPTIONS.INVALID_TOKEN],
  ];
  for (const [token, message] of cases) {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `bookie_token=${token}`)
      .expect(401);
    assert.equal(response.body.error.message, message);
  }
});

test('blocking invalidates existing JWTs and expired temporary blocks restore login', async () => {
  const { agent } = await loggedInAgent();
  await db.user.update({ where: { id: fixtures.buyer.id }, data: { status: 'BLOCKED' } });
  try {
    const response = await agent.get('/api/auth/me').expect(403);
    assert.equal(response.body.error.message, EXCEPTIONS.ACCOUNT_BLOCKED);
    const { agent: other, csrf } = await authAgent();
    await other
      .post('/login')
      .send({ email: fixtures.buyer.email, password: 'student123', _csrf: csrf })
      .expect(403);
    await db.user.update({
      where: { id: fixtures.buyer.id },
      data: { blockedUntil: new Date(Date.now() - 1000) },
    });
    await other
      .post('/login')
      .type('form')
      .send({ email: fixtures.buyer.email, password: 'student123', _csrf: csrf })
      .expect(303);
    assert.equal(
      (await db.user.findUniqueOrThrow({ where: { id: fixtures.buyer.id } })).status,
      'ACTIVE',
    );
  } finally {
    await db.user.update({
      where: { id: fixtures.buyer.id },
      data: { status: 'ACTIVE', blockedUntil: null },
    });
  }
});

test('inactive, archived and temporarily blocked accounts return clear errors after password verification', async () => {
  const { agent, csrf } = await authAgent();
  const cases = [
    [{ status: 'INACTIVE' }, EXCEPTIONS.ACCOUNT_INACTIVE],
    [{ status: 'ARCHIVED', archivedAt: new Date() }, EXCEPTIONS.ACCOUNT_ARCHIVED],
    [
      { status: 'BLOCKED', blockedUntil: new Date(Date.now() + 86400000), archivedAt: null },
      EXCEPTIONS.ACCOUNT_TEMPORARILY_BLOCKED,
    ],
  ];
  try {
    for (const [data, message] of cases) {
      await db.user.update({ where: { id: fixtures.buyer.id }, data });
      const response = await agent
        .post('/login')
        .send({ email: fixtures.buyer.email, password: 'student123', _csrf: csrf })
        .expect(403);
      assert.equal(response.body.error.message, message);
    }
  } finally {
    await db.user.update({
      where: { id: fixtures.buyer.id },
      data: { status: 'ACTIVE', blockedUntil: null, archivedAt: null },
    });
  }
});

test('CSRF protection covers login, registration and logout', async () => {
  const { agent } = await authAgent();
  const response = await agent
    .post('/login')
    .send({ email: fixtures.buyer.email, password: 'student123' })
    .expect(403);
  assert.equal(response.body.error.message, EXCEPTIONS.CSRF_INVALID);
  await agent
    .post('/register')
    .send(await registrationData())
    .expect(403);
  const { agent: loggedIn } = await loggedInAgent();
  await loggedIn.post('/logout').send({}).expect(403);
  await loggedIn.get('/api/auth/me').expect(200);
});

test('malformed and oversized requests return controlled exceptions', async () => {
  const malformed = await request(app)
    .post('/login')
    .set('Content-Type', 'application/json')
    .send('{')
    .expect(400);
  assert.equal(malformed.body.error.message, EXCEPTIONS.BAD_REQUEST);
  const oversized = await request(app)
    .post('/register')
    .send({ password: 'a'.repeat(20000) })
    .expect(413);
  assert.equal(oversized.body.error.message, EXCEPTIONS.PAYLOAD_TOO_LARGE);
});

test('role middleware denies an authenticated buyer administrator permissions', () => {
  let exception;
  require('../src/middleware/authorize.middleware').authorize('ADMIN')(
    { user: { role: 'BUYER' } },
    {},
    (error) => {
      exception = error;
    },
  );
  assert.equal(exception.status, 403);
  assert.equal(exception.message, EXCEPTIONS.FORBIDDEN);
});

test('failed login attempts are rate limited with a retry header', async () => {
  const { agent, csrf } = await authAgent();
  for (let index = 0; index < require('../src/constants/auth').LOGIN_LIMIT; index += 1) {
    await agent
      .post('/login')
      .send({ email: 'missing@example.test', password: 'Wrong123', _csrf: csrf })
      .expect(401);
  }
  const response = await agent
    .post('/login')
    .send({ email: 'missing@example.test', password: 'Wrong123', _csrf: csrf })
    .expect(429);
  assert.equal(response.body.error.message, EXCEPTIONS.TOO_MANY_ATTEMPTS);
  assert.ok(response.headers['retry-after']);
});

test('registration enforces uppercase and number independently of password length', async () => {
  const { validateRegistration } = require('../src/validators/auth.validator');
  const data = await registrationData();
  for (const password of ['reading123', 'ReadingOnly', '12345678', 'Aa1']) {
    assert.throws(
      () => validateRegistration({ ...data, password, repeatPassword: password }),
      (error) => error.fields.password === EXCEPTIONS.WEAK_PASSWORD,
    );
  }
  assert.equal(
    validateRegistration({ ...data, password: 'Abcdefg1', repeatPassword: 'Abcdefg1' }).password,
    'Abcdefg1',
  );
});

test('deactivated registration options are rejected without creating a user', async () => {
  const { agent, csrf } = await authAgent('/register');
  const data = await registrationData();
  const genreId = Number(data.genreIds[0]);
  await db.genre.update({ where: { id: genreId }, data: { isActive: false } });
  try {
    const response = await agent
      .post('/register')
      .send({ ...data, _csrf: csrf })
      .expect(422);
    assert.equal(response.body.error.fields.genreIds, EXCEPTIONS.INVALID_INTERESTS);
    assert.equal(await db.user.count({ where: { email: data.email } }), 0);
  } finally {
    await db.genre.update({ where: { id: genreId }, data: { isActive: true } });
  }
});

test('database failure and unexpected exceptions return safe centralized messages', async () => {
  const { agent, csrf } = await authAgent();
  const repository = require('../src/repositories/user.repository');
  const original = repository.findByEmail;
  const originalLog = console.error;
  console.error = () => {};
  try {
    for (const [code, status, message] of [
      ['P1001', 503, EXCEPTIONS.DATABASE_UNAVAILABLE],
      ['OTHER', 500, EXCEPTIONS.INTERNAL_ERROR],
    ]) {
      repository.findByEmail = async () => {
        const error = new Error('private implementation details');
        error.code = code;
        throw error;
      };
      const response = await agent
        .post('/login')
        .send({ email: fixtures.buyer.email, password: 'student123', _csrf: csrf })
        .expect(status);
      assert.equal(response.body.error.message, message);
      assert.ok(!JSON.stringify(response.body).includes('private implementation details'));
    }
  } finally {
    repository.findByEmail = original;
    console.error = originalLog;
  }
});

test('production auth cookies are secure and missing secrets fail explicitly', () => {
  const code =
    "const c=require('./src/config/auth'); process.stdout.write(JSON.stringify({secure:c.cookieOptions.secure,name:c.tokenCookie,httpOnly:c.cookieOptions.httpOnly}))";
  const secure = JSON.parse(
    execFileSync(process.execPath, ['-e', code], {
      cwd: root,
      env: { ...process.env, NODE_ENV: 'production' },
      encoding: 'utf8',
    }),
  );
  assert.equal(secure.secure, true);
  assert.equal(secure.httpOnly, true);
  assert.equal(secure.name, '__Host-bookie_token');
  assert.throws(() =>
    execFileSync(process.execPath, ['-e', "require('./src/config/auth')"], {
      cwd: root,
      env: { ...process.env, JWT_SECRET: '' },
      stdio: 'pipe',
    }),
  );
});

test('public and authenticated pages render without errors or chat redirect loops', async () => {
  for (const url of [
    '/',
    '/books',
    '/login',
    '/register',
    '/verify-email?email=test@example.test',
    '/books/' + fixtures.book.id,
    '/users/' + fixtures.seller.id,
  ]) {
    await request(app).get(url).expect(200);
  }
  const { agent } = await loggedInAgent();
  for (const url of [
    '/profile',
    '/profile?edit=1',
    '/profile/books',
    '/cart',
    '/orders',
    '/exchange-books',
    '/exchange-offers',
    '/chat',
    '/chat/list',
    '/notifications',
    '/report?bookId=' + fixtures.book.id,
    '/books/new',
  ]) {
    await agent.get(url).expect(200);
  }
  await agent.get('/admin').expect(403);
  await agent.get('/statistics').expect(403);
  await agent.get('/books/invalid').expect(404);
  const { agent: adminAgent, csrf } = await authAgent();
  await adminAgent
    .post('/login')
    .type('form')
    .send({
      email: fixtures.admin.email,
      password: 'admin123',
      _csrf: csrf,
    })
    .expect(303);
  for (const url of [
    '/admin',
    '/statistics',
    '/admin/catalog/genres',
    '/admin/catalog/languages',
    '/admin/catalog/cities',
    '/admin/catalog/conditions',
    '/admin/catalog/tags',
    '/admin/reports',
    '/admin/reviews',
  ])
    await adminAgent.get(url).expect(200);
});

async function freshBook(ownerId, price = 10) {
  return db.book.create({
    data: {
      title: 'Regression book',
      author: 'Test Author',
      publisher: 'Test Publisher',
      description: 'A book used for workflow regression tests.',
      publicationYear: 2020,
      price,
      allowExchange: true,
      ownerId,
      genreId: fixtures.book.genreId,
      languageId: fixtures.book.languageId,
      conditionId: fixtures.book.conditionId,
    },
  });
}

test('cart additions are idempotent and exchange-only books cannot be purchased', async () => {
  const service = require('../src/services/marketplace.service');
  const book = await freshBook(fixtures.seller.id);
  await service.add(fixtures.buyer.id, book.id);
  await service.add(fixtures.buyer.id, book.id);
  const cart = await service.cart(fixtures.buyer.id);
  assert.equal(cart.items.filter((item) => item.bookId === book.id).length, 1);
  const exchangeOnly = await freshBook(fixtures.seller.id, 0);
  await assert.rejects(
    service.add(fixtures.buyer.id, exchangeOnly.id),
    (error) => error.code === 'CART_BOOK_INVALID',
  );
  await service.remove(fixtures.buyer.id, book.id);
  await service.remove(fixtures.buyer.id, book.id);
});

test('exchange offer creates an order and completes both sides of the exchange', async () => {
  const service = require('../src/services/marketplace.service');
  const target = await freshBook(fixtures.seller.id);
  const offered = await freshBook(fixtures.buyer.id, 0);
  const order = await service.exchange(fixtures.buyer.id, fixtures.seller.id, target.id, [
    offered.id,
  ]);
  assert.ok(order.orderNumber);
  await service.changeOrder(fixtures.seller.id, order.id, 'ACCEPTED');
  assert.equal(await db.bookReservation.count({ where: { orderId: order.id } }), 2);
  await service.changeOrder(fixtures.seller.id, order.id, 'COMPLETED');
  assert.equal(
    await db.book.count({
      where: { id: { in: [target.id, offered.id] }, status: 'EXCHANGED' },
    }),
    2,
  );
  assert.equal(await db.bookReservation.count({ where: { orderId: order.id } }), 0);
  await assert.rejects(service.changeOrder(fixtures.seller.id, order.id, 'COMPLETED'));
});

test('competing offers cannot reserve the same book twice', async () => {
  const service = require('../src/services/marketplace.service');
  const target = await freshBook(fixtures.seller.id);
  const first = await freshBook(fixtures.buyer.id, 0);
  const second = await freshBook(fixtures.buyer.id, 0);
  const a = await service.exchange(fixtures.buyer.id, fixtures.seller.id, target.id, [first.id]);
  const b = await service.exchange(fixtures.buyer.id, fixtures.seller.id, target.id, [second.id]);
  const outcomes = await Promise.allSettled([
    service.changeOrder(fixtures.seller.id, a.id, 'ACCEPTED'),
    service.changeOrder(fixtures.seller.id, b.id, 'ACCEPTED'),
  ]);
  assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(
    await db.order.count({ where: { id: { in: [a.id, b.id] }, status: 'ACCEPTED' } }),
    1,
  );
});

test('chat rejects nonparticipants, reuses conversations and stores read state', async () => {
  const chat = require('../src/repositories/chat.repository');
  const conversation = await chat.create(fixtures.buyer.id, fixtures.seller.id, fixtures.book.id);
  assert.equal(
    (await chat.create(fixtures.buyer.id, fixtures.seller.id, fixtures.book.id)).id,
    conversation.id,
  );
  await assert.rejects(
    chat.addMessage(conversation.id, fixtures.admin.id, 'Not allowed'),
    (error) => error.code === 'CHAT_FORBIDDEN',
  );
  const message = await chat.addMessage(conversation.id, fixtures.buyer.id, 'Hello');
  await chat.markRead(conversation.id, fixtures.seller.id, message.createdAt);
  const data = await chat.findForUser(conversation.id, fixtures.seller.id);
  assert.ok(data.participants.find((item) => item.userId === fixtures.seller.id).lastReadAt);
});

test('invalid review edits do not change the saved rating', async () => {
  const service = require('../src/services/marketplace.service');
  const item = await db.orderItem.findFirst({
    where: { order: { buyerId: fixtures.buyer.id, status: 'COMPLETED' }, review: { isNot: null } },
    include: { review: true },
  });
  assert.ok(item);
  await assert.rejects(
    service.editReview(fixtures.buyer.id, item.review.id, 8, 'invalid'),
    (error) => error.code === 'REVIEW_INVALID',
  );
  assert.equal(
    (await db.review.findUnique({ where: { id: item.review.id } })).rating,
    item.review.rating,
  );
});

test('duplicate checkout requests produce only one order and clear purchased cart entries', async () => {
  const service = require('../src/services/marketplace.service');
  const cart = await service.cart(fixtures.buyer.id);
  await db.cartItem.deleteMany({ where: { cartId: cart.id } });
  const book = await freshBook(fixtures.seller.id);
  await service.add(fixtures.buyer.id, book.id);
  const outcomes = await Promise.allSettled([
    service.checkout(fixtures.buyer.id),
    service.checkout(fixtures.buyer.id),
  ]);
  assert.equal(outcomes.filter((item) => item.status === 'fulfilled').length, 1);
  const order = await db.order.findFirstOrThrow({
    where: { items: { some: { bookId: book.id } } },
  });
  assert.equal(await db.order.count({ where: { items: { some: { bookId: book.id } } } }), 1);
  await service.changeOrder(fixtures.seller.id, order.id, 'ACCEPTED');
  await service.changeOrder(fixtures.seller.id, order.id, 'COMPLETED');
  assert.equal((await db.book.findUnique({ where: { id: book.id } })).status, 'SOLD');
});

test('reports support in-review, rejection and resolution; notifications are owner-scoped', async () => {
  const community = require('../src/services/community.service');
  const adminService = require('../src/services/admin.service');
  const report = await community.report(fixtures.buyer.id, {
    bookId: fixtures.book.id,
    reason: 'Test report',
  });
  for (const status of ['IN_REVIEW', 'REJECTED', 'RESOLVED'])
    await adminService.resolveReport(fixtures.admin.id, report.id, status);
  const notice = await db.notification.create({
    data: {
      userId: fixtures.buyer.id,
      type: 'SYSTEM',
      title: 'Test notification',
      body: 'Test body',
    },
  });
  assert.equal((await community.markRead(fixtures.seller.id, notice.id)).count, 0);
  assert.equal((await community.markRead(fixtures.buyer.id, notice.id)).count, 1);
});

test('saving a seller profile preserves its avatar and does not require buyer interests', async () => {
  const { agent, csrf } = await authAgent();
  await agent
    .post('/login')
    .type('form')
    .send({
      email: fixtures.seller.email,
      password: 'student123',
      _csrf: csrf,
    })
    .expect(303);
  await db.user.update({
    where: { id: fixtures.seller.id },
    data: { avatarUrl: '/users/profile-pictures/test.jpg' },
  });
  const form = await agent.get('/profile?edit=1').expect(200);
  await agent
    .post('/profile')
    .type('form')
    .send({
      _csrf: csrfFrom(form.text),
      phone: '+38761123456',
      cityId: fixtures.seller.cityId,
      bio: 'Updated biography',
    })
    .expect(303);
  const user = await db.user.findUnique({ where: { id: fixtures.seller.id } });
  assert.equal(user.avatarUrl, '/users/profile-pictures/test.jpg');
  assert.equal(user.bio, 'Updated biography');
});

test('email verification rejects malformed, expired and reused codes', async () => {
  const service = require('../src/services/auth.service');
  const { hashCode } = require('../src/utils/verification');
  const data = await registrationData();
  const user = await db.user.create({
    data: {
      firstName: 'Verify',
      lastName: 'Reader',
      email: data.email,
      phone: data.phone,
      passwordHash: fixtures.buyer.passwordHash,
      role: 'BUYER',
      verificationCodeHash: hashCode('123456'),
      verificationCodeExpiresAt: new Date(Date.now() + 60000),
    },
  });
  await assert.rejects(
    service.verifyEmail(user.email, ['123456']),
    (error) => error.code === 'EMAIL_VERIFICATION_INVALID',
  );
  await assert.rejects(
    service.verifyEmail(user.email, '000000'),
    (error) => error.code === 'EMAIL_VERIFICATION_INVALID',
  );
  const session = await service.verifyEmail(user.email, '123456');
  assert.ok(session.token);
  await assert.rejects(
    service.verifyEmail(user.email, '123456'),
    (error) => error.code === 'EMAIL_VERIFICATION_INVALID',
  );
});

test('password changes validate the current password and revoke existing sessions', async () => {
  const service = require('../src/services/profile.service');
  const { agent } = await loggedInAgent();
  const input = {
    currentPassword: 'student123',
    password: 'Updated123',
    repeatPassword: 'Updated123',
  };
  await assert.rejects(
    service.changePassword(fixtures.buyer.id, { ...input, currentPassword: 'Wrong123' }),
  );
  await assert.rejects(service.changePassword(fixtures.buyer.id, { ...input, password: 'weak' }));
  await service.changePassword(fixtures.buyer.id, input);
  await agent.get('/api/auth/me').expect(401);
  assert.ok(
    await require('bcryptjs').compare(
      'Updated123',
      (await db.user.findUnique({ where: { id: fixtures.buyer.id } })).passwordHash,
    ),
  );
});

test('resending verification replaces the previous code and enforces the cooldown', async (t) => {
  const service = require('../src/services/auth.service');
  const { hashCode } = require('../src/utils/verification');
  const data = await registrationData();
  const user = await db.user.create({
    data: {
      firstName: 'Resend',
      lastName: 'Reader',
      email: data.email,
      phone: data.phone,
      passwordHash: fixtures.buyer.passwordHash,
      role: 'BUYER',
      verificationCodeHash: hashCode('123456'),
      verificationCodeExpiresAt: new Date(Date.now() + 60000),
      verificationCodeSentAt: new Date(Date.now() - 30000),
    },
  });
  const oldFetch = global.fetch;
  const oldKey = process.env.RESEND_API_KEY;
  const oldFrom = process.env.RESEND_FROM_EMAIL;
  const messages = [];
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    messages.push(JSON.parse(options.body));
    return { ok: true };
  };
  process.env.RESEND_API_KEY = 'test-only-placeholder';
  process.env.RESEND_FROM_EMAIL = 'test@example.test';
  t.after(() => {
    global.fetch = oldFetch;
    process.env.RESEND_API_KEY = oldKey;
    process.env.RESEND_FROM_EMAIL = oldFrom;
  });
  await service.resendVerification(user.email);
  assert.equal(messages.length, 1);
  await service.resendVerification(user.email);
  assert.equal(messages.length, 1);
  const latest = messages[0].html.match(/>(\d{6})</)[1];
  if (latest !== '123456') await assert.rejects(service.verifyEmail(user.email, '123456'));
  await db.user.update({
    where: { id: user.id },
    data: { verificationCodeExpiresAt: new Date(Date.now() - 1000) },
  });
  await assert.rejects(service.verifyEmail(user.email, latest));
});

test('admin catalog deactivation and deletion respect referenced data', async () => {
  const service = require('../src/services/admin.service');
  const genre = await service.addCatalog('genres', { name: 'Regression genre' });
  await service.editCatalog('genres', genre.id, { name: genre.name });
  assert.equal((await db.genre.findUnique({ where: { id: genre.id } })).isActive, false);
  await service.deleteCatalog('genres', genre.id);
  await assert.rejects(service.deleteCatalog('genres', fixtures.book.genreId));
});
