const express = require('express');
const roles = require('../../constants/roles');
const asyncHandler = require('../../utils/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const tenantValidation = require('../../middleware/tenantValidation');
const dashboardController = require('./controller');

const router = express.Router();

router.use(authenticate);
router.use(tenantValidation);
router.use(authorize([roles.ADMIN, roles.GUARDIAN]));

router.get(
  '/overview',
  asyncHandler(dashboardController.getOverview),
);

router.get(
  '/residents',
  asyncHandler(dashboardController.listResidents),
);

router.get(
  '/notifications',
  asyncHandler(dashboardController.listNotifications),
);

router.get(
  '/residents/:residentId',
  asyncHandler(dashboardController.getResidentDashboard),
);

module.exports = {
  router,
};
