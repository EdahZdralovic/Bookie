const express = require('express');
const controller = require('../controllers/book.controller');
const detailController = require('../controllers/book-detail.controller');
const { requireAuthentication, authorize } = require('../middleware/authorize.middleware');
const { protectCsrf } = require('../middleware/csrf.middleware');

const router = express.Router();
router.get('/books/new', requireAuthentication, authorize('SELLER'), controller.showCreate);
router.post('/books', requireAuthentication, authorize('SELLER'), protectCsrf, controller.create);
router.get('/books/:publicId', detailController.show);
module.exports = router;
