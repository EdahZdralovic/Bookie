const express = require('express');
const controller = require('../controllers/profile.controller');
const { requireAuthentication } = require('../middleware/authorize.middleware');
const { protectCsrf } = require('../middleware/csrf.middleware');
const { profileUpload } = require('../middleware/upload.middleware');

const router = express.Router();
router.get('/profile', requireAuthentication, controller.show);
router.get('/profile/books', requireAuthentication, controller.books);
router.get('/users/:id', controller.publicProfile);
router.post('/profile', requireAuthentication, profileUpload, protectCsrf, controller.update);
module.exports = router;
