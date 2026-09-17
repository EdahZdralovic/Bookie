const express = require('express');
const controller = require('../controllers/book.controller');
const detailController = require('../controllers/book-detail.controller');
const { requireAuthentication, authorize } = require('../middleware/authorize.middleware');
const { protectCsrf } = require('../middleware/csrf.middleware');
const { bookUpload } = require('../middleware/upload.middleware');

const router = express.Router();
router.get(
  '/books/new',
  requireAuthentication,
  authorize('SELLER', 'BUYER'),
  controller.showCreate,
);
router.post(
  '/books',
  requireAuthentication,
  authorize('SELLER', 'BUYER'),
  bookUpload,
  protectCsrf,
  controller.create,
);
router.get(
  '/books/:id/edit',
  requireAuthentication,
  authorize('SELLER', 'BUYER'),
  controller.editForm,
);
router.post(
  '/books/:id',
  requireAuthentication,
  authorize('SELLER', 'BUYER'),
  bookUpload,
  protectCsrf,
  controller.update,
);
router.post(
  '/books/:id/archive',
  requireAuthentication,
  authorize('SELLER', 'BUYER'),
  protectCsrf,
  controller.archive,
);
router.post(
  '/books/:id/delete',
  requireAuthentication,
  authorize('SELLER', 'BUYER'),
  protectCsrf,
  controller.remove,
);
router.get('/books/:id', detailController.show);
module.exports = router;
