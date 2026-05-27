const express = require('express');
const roles = require('../../constants/roles');
const asyncHandler = require('../../utils/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const tenantValidation = require('../../middleware/tenantValidation');
const authController = require('./controller');

const router = express.Router();

router.post('/tenants', asyncHandler(authController.createTenant));
router.post('/login', asyncHandler(authController.login));
router.post('/refresh', asyncHandler(authController.refresh));
router.post('/logout', asyncHandler(authController.logout));

router.post(
  '/register',
  authenticate,
  tenantValidation,
  authorize([roles.ADMIN]),
  asyncHandler(authController.register),
);

router.post(
  '/logout-all',
  authenticate,
  tenantValidation,
  asyncHandler(authController.logoutAll),
);

router.get(
  '/me',
  authenticate,
  tenantValidation,
  asyncHandler(authController.me),
);

module.exports = {
  router,
  authenticate,
  authorize,
  tenantValidation,
};
