const express = require('express');
const homeController = require('../controllers/home.controller');
const catalogController = require('../controllers/catalog.controller');

const router = express.Router();
for (const name of ['id', 'bookId', 'itemId'])
  router.param(name, require('../middleware/id.middleware'));

router.get('/', homeController.showHome);
router.get('/books', catalogController.show);

module.exports = router;
