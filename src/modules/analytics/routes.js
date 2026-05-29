const express = require('express');
const roles = require('../../constants/roles');
const asyncHandler = require('../../utils/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const tenantValidation = require('../../middleware/tenantValidation');
const analyticsController = require('./controller');

const router = express.Router();

router.use(authenticate);
router.use(tenantValidation);

router.get(
  '/residents/:residentId',
  authorize([roles.ADMIN, roles.CARETAKER, roles.GUARDIAN]),
  asyncHandler(analyticsController.getResidentAnalytics),
);

module.exports = {
  router,
};
