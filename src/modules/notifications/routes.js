const express = require('express');
const roles = require('../../constants/roles');
const asyncHandler = require('../../utils/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const tenantValidation = require('../../middleware/tenantValidation');
const notificationsController = require('./controller');

const router = express.Router();

router.use(authenticate);
router.use(tenantValidation);
router.use(authorize([roles.ADMIN, roles.CARETAKER, roles.GUARDIAN]));

router.get(
  '/',
  asyncHandler(notificationsController.listNotifications),
);

router.get(
  '/residents/:residentId',
  asyncHandler(notificationsController.listResidentNotifications),
);

router.patch(
  '/:id/read',
  asyncHandler(notificationsController.markNotificationAsRead),
);

module.exports = {
  router,
};
