const express = require('express');
const controller = require('../controllers/offer.controller');
const { requireAuthentication, authorize } = require('../middleware/authorize.middleware');
const router = express.Router();
router.get('/exchange-offers', requireAuthentication, authorize('SELLER'), controller.list);
module.exports = router;
