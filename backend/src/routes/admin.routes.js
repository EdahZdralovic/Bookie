const express = require('express');
const controller = require('../controllers/admin.controller');
const { requireAuthentication, authorize } = require('../middleware/authorize.middleware');
const { protectCsrf } = require('../middleware/csrf.middleware');

const router = express.Router();
for (const name of ['id', 'bookId', 'itemId'])
  router.param(name, require('../middleware/id.middleware'));
router.use('/admin', requireAuthentication, authorize('ADMIN'));
router.get('/admin', controller.dashboard);
router.post('/admin/users/:id/status', protectCsrf, controller.userStatus);
router.get('/admin/catalog/:type', controller.catalog);
router.post('/admin/catalog/:type', protectCsrf, controller.addCatalog);
router.post('/admin/catalog/:type/:id', protectCsrf, controller.editCatalog);
router.post('/admin/catalog/:type/:id/delete', protectCsrf, controller.deleteCatalog);
router.get('/admin/reports', controller.reports);
router.post('/admin/reports/:id/status', protectCsrf, controller.resolveReport);
router.post('/admin/users/:id/notify', protectCsrf, controller.notify);
router.get('/admin/reviews', controller.reviews);
router.post('/admin/reviews/:id/delete', protectCsrf, controller.removeReview);
module.exports = router;
