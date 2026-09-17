const express = require('express');
const controller = require('../controllers/statistics.controller');
const { requireAuthentication, authorize } = require('../middleware/authorize.middleware');

const router = express.Router();
for (const name of ['id', 'bookId', 'itemId'])
  router.param(name, require('../middleware/id.middleware'));
router.get('/statistics', requireAuthentication, authorize('ADMIN'), controller.show);

module.exports = router;
