const AppException = require('./app.exception');
const HTTP = require('../constants/http');
const TEXT = require('../constants/auth-text');

function notFound(req, res, next) {
  return next(new AppException('NOT_FOUND', HTTP.NOT_FOUND));
}

function normalizeException(error) {
  if (error instanceof AppException) return error;
  if (error.type === 'entity.too.large') return new AppException('PAYLOAD_TOO_LARGE', HTTP.PAYLOAD_TOO_LARGE);
  if (error.status === HTTP.BAD_REQUEST) return new AppException('BAD_REQUEST', HTTP.BAD_REQUEST);
  if (['P1001', 'P1002', 'P1008', 'P1017', 'P2024'].includes(error.code) || error.name === 'PrismaClientInitializationError') {
    return new AppException('DATABASE_UNAVAILABLE', HTTP.UNAVAILABLE);
  }
  return new AppException('INTERNAL_ERROR', HTTP.INTERNAL_ERROR);
}

async function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const exception = normalizeException(error);
  if (exception.status >= HTTP.INTERNAL_ERROR) console.error({ name: error.name, code: error.code });
  if (req.path.startsWith('/api/') || req.is('application/json')) {
    return res.status(exception.status).json({ error: { code: exception.code, message: exception.message, fields: exception.fields } });
  }
  if (res.locals.authPage && exception.status < HTTP.INTERNAL_ERROR) {
    try {
      return await require('../controllers/auth.controller').renderForm(req, res, exception);
    } catch (renderError) {
      const fallback = normalizeException(renderError);
      return res.status(fallback.status).render('pages/error', { title: TEXT.ERROR_TITLE, message: fallback.message });
    }
  }
  return res.status(exception.status).render('pages/error', {
    title: exception.status === HTTP.NOT_FOUND ? TEXT.NOT_FOUND_TITLE : TEXT.ERROR_TITLE,
    message: exception.message,
  });
}

module.exports = { notFound, errorHandler };
