const express = require('express');
const controller = require('../controllers/profile.controller');
const { requireAuthentication } = require('../middleware/authorize.middleware');
const { protectCsrf } = require('../middleware/csrf.middleware');

const router = express.Router();
router.get('/profile', requireAuthentication, controller.show);
router.post('/profile', requireAuthentication, protectCsrf, controller.update);
module.exports = router;
