const express = require('express');
const controller = require('../controllers/auth.controller');
const { guestOnly, requireAuthentication } = require('../middleware/authorize.middleware');
const { protectCsrf } = require('../middleware/csrf.middleware');
const { loginLimiter, registerLimiter } = require('../middleware/rate-limit.middleware');
const { PATHS } = require('../constants/auth');

const router = express.Router();

router.get(PATHS.LOGIN, guestOnly, controller.formContext('login'), (req, res) => controller.renderForm(req, res));
router.get(PATHS.REGISTER, guestOnly, controller.formContext('register'), (req, res) => controller.renderForm(req, res));
router.post(PATHS.LOGIN, guestOnly, controller.formContext('login'), loginLimiter, protectCsrf, controller.login);
router.post(PATHS.REGISTER, guestOnly, controller.formContext('register'), registerLimiter, protectCsrf, controller.register);
router.post(PATHS.LOGOUT, protectCsrf, controller.logout);
router.get(PATHS.ACCOUNT, requireAuthentication, controller.account);
router.get(PATHS.ME, requireAuthentication, controller.me);

module.exports = router;
