 const express = require('express');
const homeController = require('../controllers/home.controller');
const catalogController = require('../controllers/catalog.controller');

const router = express.Router();

router.get('/', homeController.showHome);
router.get('/books', catalogController.show);

module.exports = router;
