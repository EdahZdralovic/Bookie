const express = require('express');
const controller = require('../controllers/offer.controller');
const { requireAuthentication, authorize } = require('../middleware/authorize.middleware');
const router = express.Router();
for (const name of ['id', 'bookId', 'itemId'])
  router.param(name, require('../middleware/id.middleware'));
router.get(
  '/exchange-offers',
  requireAuthentication,
  authorize('SELLER', 'BUYER'),
  controller.list,
);
module.exports = router;
