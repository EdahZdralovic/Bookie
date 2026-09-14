const EXCEPTIONS = require('../constants/exceptions');
const HTTP = require('../constants/http');

class AppException extends Error {
  constructor(code, status = HTTP.BAD_REQUEST, fields = {}) {
    super(EXCEPTIONS[code] || EXCEPTIONS.INTERNAL_ERROR);
    this.name = 'AppException';
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

module.exports = AppException;
