const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('@playwright/test');
require('dotenv').config({ quiet: true });
process.env.RESEND_API_KEY = '';
process.env.RESEND_FROM_EMAIL = '';
const { PrismaClient } = require('@prisma/client');

const root = path.resolve(__dirname, '..');
const databaseName = `bookie_browser_${process.pid}_${Date.now()}`;
const adminUrl = new URL(process.env.DATABASE_URL);
adminUrl.pathname = '/postgres';
const databaseUrl = new URL(process.env.DATABASE_URL);
databaseUrl.pathname = `/${databaseName}`;
const admin = new PrismaClient({ datasources: { db: { url: adminUrl.href } } });
const db = new PrismaClient({ datasources: { db: { url: databaseUrl.href } } });
let created = false;
let browser;
let server;
let appDatabase;

async function main() {
  assert.match(databaseName, /^bookie_browser_\d+_\d+$/);
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  created = true;
  process.env.DATABASE_URL = databaseUrl.href;
  execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
    cwd: root,
    env: process.env,
    stdio: 'pipe',
  });
  await require('../prisma/seed').seedDatabase(db);
  const app = require('../src/app');
  appDatabase = require('../src/config/database');
  server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const screenshots = path.join(root, '.local', 'screenshots');
  fs.mkdirSync(screenshots, { recursive: true });
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/login`);
  await page.screenshot({ path: path.join(screenshots, 'login-desktop.png'), fullPage: true });
  await page.goto(`${base}/register`);
  await page.screenshot({ path: path.join(screenshots, 'register-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  assert.equal(
    await page.locator('#firstName-error').textContent(),
    require('../src/constants/exceptions').REQUIRED_FIELD,
  );
  await page.locator('#phone').fill('+38761000000');
  await page.locator('#firstName').fill('Browser');
  await page.locator('#lastName').fill('Reader');
  await page.locator('#email').fill('browser-reader@example.test');
  await page.locator('#password').fill('weak');
  await page.locator('#repeatPassword').fill('different');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  assert.equal(
    await page.locator('#password-error').textContent(),
    require('../src/constants/exceptions').WEAK_PASSWORD,
  );
  assert.equal(
    await page.locator('#repeatPassword-error').textContent(),
    require('../src/constants/exceptions').PASSWORD_MISMATCH,
  );
  await page.locator('#password').fill('Browser123');
  await page.locator('#repeatPassword').fill('Browser123');
  await page.locator('[data-toggle="password"]').click();
  assert.equal(await page.locator('#password').getAttribute('type'), 'text');
  await page.locator('[data-toggle="password"]').click();
  assert.equal(await page.locator('#password').getAttribute('type'), 'password');
  await page.locator('[name="role"][value="BUYER"]').check();
  const cityId = await page.locator('#cityId option').nth(1).getAttribute('value');
  await page.locator('#cityId').selectOption(cityId);
  await page.locator('[name="genreIds"]').first().check();
  await page.locator('[name="languageIds"]').first().check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.waitForURL(`${base}/account`);
  assert.match(await page.locator('main').textContent(), /browser-reader@example.test/);
  assert.ok((await context.cookies()).find((cookie) => cookie.name === 'bookie_token').httpOnly);
  assert.ok(!(await page.evaluate(() => document.cookie)).includes('bookie_token'));
  await page.screenshot({ path: path.join(screenshots, 'account-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await page.waitForURL(`${base}/login`);
  await page.locator('#email').fill('browser-reader@example.test');
  await page.locator('#password').fill('Wrong123');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.waitForSelector('[data-form-alert]:not([hidden])');
  assert.equal(
    (await page.locator('[data-form-message]').textContent()).trim(),
    require('../src/constants/exceptions').INVALID_CREDENTIALS,
  );
  assert.equal(await page.locator('#password').inputValue(), '');
  await page.screenshot({ path: path.join(screenshots, 'login-error.png'), fullPage: true });
  await page.locator('#password').fill('Browser123');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.waitForURL(`${base}/account`);
  await context.close();
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    deviceScaleFactor: 1,
  });
  const mobilePage = await mobile.newPage();
  for (const route of ['login', 'register']) {
    await mobilePage.goto(`${base}/${route}`);
    assert.ok(
      await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    );
    await mobilePage.screenshot({
      path: path.join(screenshots, `${route}-mobile.png`),
      fullPage: true,
    });
  }
  await mobile.close();
  const noScript = await browser.newContext({ javaScriptEnabled: false });
  const noScriptPage = await noScript.newPage();
  await noScriptPage.goto(`${base}/login`);
  await noScriptPage.locator('#email').fill('browser-reader@example.test');
  await noScriptPage.locator('#password').fill('Browser123');
  await noScriptPage.getByRole('button', { name: 'Log in', exact: true }).click();
  await noScriptPage.waitForURL(`${base}/account`);
  await noScript.close();
  const seller = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const sellerPage = await seller.newPage();
  await sellerPage.goto(`${base}/login`);
  await sellerPage.locator('#email').fill('prodavac@bookie.ba');
  await sellerPage.locator('#password').fill('student123');
  await sellerPage.getByRole('button', { name: 'Log in', exact: true }).click();
  await sellerPage.waitForURL(`${base}/account`);
  await sellerPage.goto(`${base}/books/new`);
  assert.match(await sellerPage.locator('h1').textContent(), /Give your book/);
  await sellerPage.locator('.workflow-form button[type="submit"]').click();
  assert.equal(
    (await sellerPage.locator('#title + .field-error').textContent()).trim(),
    require('../src/constants/exceptions').BOOK_TITLE_REQUIRED,
  );
  await sellerPage.locator('#title').fill('Browser Book');
  await sellerPage.locator('#author').fill('Browser Author');
  await sellerPage.locator('#publisher').fill('Browser Press');
  await sellerPage.locator('#publicationYear').fill('2024');
  await sellerPage.locator('#description').fill('A browser-created book for validation.');
  await sellerPage.locator('#price').fill('12.50');
  for (const id of ['genreId', 'languageId', 'conditionId', 'cityId'])
    await sellerPage
      .locator(`#${id} option`)
      .nth(1)
      .getAttribute('value')
      .then((value) => sellerPage.locator(`#${id}`).selectOption(value));
  await sellerPage.locator('.workflow-form button[type="submit"]').click();
  await sellerPage.waitForURL(`${base}/account?bookCreated=1`, { timeout: 5000 });
  assert.match(await sellerPage.locator('[role="status"]').textContent(), /successfully/);
  await sellerPage.goto(`${base}/profile?edit=1`);
  assert.equal(await sellerPage.locator('input[name="avatar"]').count(), 1);
  await sellerPage.locator('#phone').fill('+38761234567');
  await sellerPage.locator('form[action="/profile"][method="post"] button[type="submit"]').click();
  await sellerPage.waitForURL(`${base}/profile?saved=1`);
  for (const width of [390, 768, 1024, 1440]) {
    await sellerPage.setViewportSize({ width, height: 900 });
    await sellerPage.goto(`${base}/books`);
    assert.ok(
      await sellerPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      `Catalog overflow at ${width}`,
    );
    const toggle = sellerPage.locator('[data-menu-open]');
    assert.equal(await toggle.isVisible(), width < 1280);
    if (width < 1280) {
      await toggle.click();
      const bounds = await sellerPage.locator('#mobile-menu').boundingBox();
      assert.ok(bounds.height >= 899);
      await sellerPage.locator('.mobile-menu-close').click();
    }
  }
  await sellerPage.goto(`${base}/profile?edit=1`);
  const previousAvatar = await db.user.findUnique({ where: { email: 'prodavac@bookie.ba' } });
  await sellerPage.locator('input[name="avatar"]').setInputFiles({
    name: 'avatar.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/YQAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await sellerPage.locator('form[action="/profile"][method="post"] button[type="submit"]').click();
  await sellerPage.waitForURL(`${base}/profile?saved=1`);
  const withAvatar = await db.user.findUnique({ where: { email: 'prodavac@bookie.ba' } });
  assert.match(withAvatar.avatarUrl, /^\/users\/profile-pictures\/[a-f0-9]{32}\.png$/);
  assert.notEqual(withAvatar.avatarUrl, previousAvatar.avatarUrl);
  fs.unlinkSync(path.join(root, '../frontend/public', withAvatar.avatarUrl));
  await sellerPage.close();
  await seller.close();
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  adminPage.on('pageerror', (error) => errors.push(error.message));
  await adminPage.goto(`${base}/login`);
  await adminPage.locator('#email').fill('admin@bookie.ba');
  await adminPage.locator('#password').fill('admin123');
  await adminPage.getByRole('button', { name: 'Log in', exact: true }).click();
  await adminPage.waitForURL(`${base}/account`);
  for (const width of [390, 768, 1440]) {
    await adminPage.setViewportSize({ width, height: 900 });
    await adminPage.goto(`${base}/statistics`);
    await adminPage.waitForFunction(
      () => typeof Chart !== 'undefined' && Chart.getChart('genreChart'),
    );
    assert.ok(
      await adminPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `Statistics overflow at ${width}`,
    );
  }
  await adminContext.close();
  assert.deepEqual(errors, []);
  console.log(
    'Browser checks passed: desktop/mobile layouts, client validation, registration, JWT cookie, login/logout, server errors, and login without JavaScript.',
  );
  console.log(`Screenshots: ${screenshots}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    if (appDatabase) await appDatabase.$disconnect();
    await db.$disconnect();
    if (created) await admin.$executeRawUnsafe(`DROP DATABASE "${databaseName}"`);
    await admin.$disconnect();
  });
