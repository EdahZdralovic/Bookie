const AUTH = require('../constants/auth');
const EXCEPTIONS = require('../constants/exceptions');
const HTTP = require('../constants/http');
const AppException = require('../exceptions/app.exception');

const text = (value) => (typeof value === 'string' ? value : '');
const selected = (value) => (Array.isArray(value) ? value : value === undefined ? [] : [value]);
const isId = (value) =>
  typeof value === 'string' && /^[1-9]\d{0,9}$/.test(value) && Number(value) <= 2147483647;
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

function safeValues(body = {}) {
  return {
    firstName: text(body.firstName).trim().slice(0, AUTH.NAME_MAX_LENGTH),
    lastName: text(body.lastName).trim().slice(0, AUTH.NAME_MAX_LENGTH),
    email: text(body.email).trim().slice(0, AUTH.EMAIL_MAX_LENGTH),
    phone: text(body.phone).trim().slice(0, 30),
    role: AUTH.PUBLIC_ROLES.includes(body.role) ? body.role : '',
    cityId: isId(body.cityId) ? body.cityId : '',
    genreIds: selected(body.genreIds).filter(isId).slice(0, AUTH.MAX_INTERESTS),
    languageIds: selected(body.languageIds).filter(isId).slice(0, AUTH.MAX_INTERESTS),
  };
}

function validateEmail(body, errors) {
  const email = text(body.email).trim().toLowerCase();
  if (!email) errors.email = EXCEPTIONS.REQUIRED_FIELD;
  else if (email.length > AUTH.EMAIL_MAX_LENGTH) errors.email = EXCEPTIONS.EMAIL_TOO_LONG;
  else if (!isEmail(email)) errors.email = EXCEPTIONS.INVALID_EMAIL;
  return email;
}

function validateLogin(body = {}) {
  const errors = {};
  const email = validateEmail(body, errors);
  const password = text(body.password);
  if (!password) errors.password = EXCEPTIONS.REQUIRED_FIELD;
  else if (Buffer.byteLength(password, 'utf8') > AUTH.PASSWORD.MAX_BYTES)
    errors.password = EXCEPTIONS.PASSWORD_TOO_LONG;
  if (Object.keys(errors).length)
    throw new AppException('VALIDATION_FAILED', HTTP.UNPROCESSABLE, errors);
  return { email, password };
}

function validateRegistration(body = {}) {
  const errors = {};
  const data = { email: validateEmail(body, errors) };
  data.phone = text(body.phone).trim();
  if (!data.phone) errors.phone = EXCEPTIONS.PHONE_REQUIRED;
  else if (!/^\+?[0-9 ()-]{7,20}$/.test(data.phone)) errors.phone = EXCEPTIONS.PHONE_INVALID;
  for (const field of ['firstName', 'lastName']) {
    data[field] = text(body[field]).trim();
    if (!data[field]) errors[field] = EXCEPTIONS.REQUIRED_FIELD;
    else if (data[field].length > AUTH.NAME_MAX_LENGTH) errors[field] = EXCEPTIONS.NAME_TOO_LONG;
    else if (!/^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u.test(data[field]))
      errors[field] = EXCEPTIONS.INVALID_NAME;
  }
  data.password = text(body.password);
  if (!data.password) errors.password = EXCEPTIONS.REQUIRED_FIELD;
  else if (Buffer.byteLength(data.password, 'utf8') > AUTH.PASSWORD.MAX_BYTES)
    errors.password = EXCEPTIONS.PASSWORD_TOO_LONG;
  else if (
    data.password.length < AUTH.PASSWORD.MIN_LENGTH ||
    !/\p{Lu}/u.test(data.password) ||
    !/[0-9]/.test(data.password)
  )
    errors.password = EXCEPTIONS.WEAK_PASSWORD;
  if (!text(body.repeatPassword)) errors.repeatPassword = EXCEPTIONS.REQUIRED_FIELD;
  else if (data.password !== body.repeatPassword)
    errors.repeatPassword = EXCEPTIONS.PASSWORD_MISMATCH;
  data.role = body.role;
  if (!AUTH.PUBLIC_ROLES.includes(data.role)) errors.role = EXCEPTIONS.INVALID_ROLE;
  if (!isId(body.cityId)) errors.cityId = EXCEPTIONS.INVALID_CITY;
  data.cityId = Number(body.cityId);
  for (const field of ['genreIds', 'languageIds']) {
    const ids = selected(body[field]);
    if (ids.length === 0 && data.role !== AUTH.ROLES.SELLER)
      errors[field] =
        field === 'genreIds' ? EXCEPTIONS.GENRES_REQUIRED : EXCEPTIONS.LANGUAGES_REQUIRED;
    else if (ids.length > AUTH.MAX_INTERESTS || !ids.every(isId))
      errors[field] = EXCEPTIONS.INVALID_INTERESTS;
    data[field] = [...new Set(ids.filter(isId).map(Number))];
  }
  if (Object.keys(errors).length)
    throw new AppException('VALIDATION_FAILED', HTTP.UNPROCESSABLE, errors);
  return data;
}

module.exports = { validateLogin, validateRegistration, safeValues };
