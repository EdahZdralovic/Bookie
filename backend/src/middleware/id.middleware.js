const AppException = require('../exceptions/app.exception');
const HTTP = require('../constants/http');

function validateId(req, res, next, value) {
  if (!/^[1-9]\d*$/.test(value) || Number(value) > 2147483647)
    return next(new AppException('NOT_FOUND', HTTP.NOT_FOUND));
  return next();
}
module.exports = validateId;
