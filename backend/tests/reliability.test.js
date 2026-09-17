const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const { validateProfile } = require('../src/validators/profile.validator');
const { validateRegistration } = require('../src/validators/auth.validator');
const { parseFilters } = require('../src/validators/catalog.validator');
const EXCEPTIONS = require('../src/constants/exceptions');

test('profile validation rejects invalid phone and allows sellers to skip interests', () => {
  assert.throws(
    () => validateProfile({ phone: 'abc', genreIds: ['1'], languageIds: ['1'] }),
    (error) => error.fields.phone === EXCEPTIONS.PHONE_INVALID,
  );
  assert.deepEqual(validateProfile({ phone: '+38761000000' }, 'SELLER').genreIds, []);
  assert.throws(() => validateProfile({ phone: '+38761000000' }, 'BUYER'));
});

test('seller registration accepts no interests and buyer registration requires them', () => {
  const input = {
    firstName: 'Test',
    lastName: 'Reader',
    phone: '+38761000000',
    email: 'reader@example.test',
    password: 'Reading123',
    repeatPassword: 'Reading123',
    cityId: '1',
    role: 'SELLER',
  };
  assert.deepEqual(validateRegistration(input).genreIds, []);
  assert.throws(
    () => validateRegistration({ ...input, role: 'BUYER' }),
    (error) => error.fields.genreIds === EXCEPTIONS.GENRES_REQUIRED,
  );
});

test('catalog filters reject overflow and normalize reversed price ranges', () => {
  const filters = parseFilters({
    genreId: '999999999999',
    minPrice: '30',
    maxPrice: '10',
    sort: 'invalid',
  });
  assert.equal(filters.genreId, undefined);
  assert.equal(filters.minPrice, 10);
  assert.equal(filters.maxPrice, 30);
  assert.equal(filters.sort, 'newest');
});

test('every EJS template compiles', () => {
  const root = path.resolve(__dirname, '../../frontend/views');
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (file.endsWith('.ejs')) {
        const source = fs.readFileSync(file, 'utf8');
        assert.doesNotThrow(() => ejs.compile(source, { filename: file }), file);
        assert.doesNotMatch(source, /<!=/, file);
      }
    }
  }
  visit(root);
});
