const express = require('express');
const controller = require('../controllers/chat.controller');
const { requireAuthentication } = require('../middleware/authorize.middleware');
const { protectCsrf } = require('../middleware/csrf.middleware');
const router = express.Router();
for (const name of ['id', 'bookId', 'itemId'])
  router.param(name, require('../middleware/id.middleware'));
router.get('/chat', requireAuthentication, controller.open);
router.get('/chat/new', requireAuthentication, controller.open);
router.get('/chat/list', requireAuthentication, controller.list);
router.post('/chat/:id/messages', requireAuthentication, protectCsrf, controller.send);
module.exports = router;
