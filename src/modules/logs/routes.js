const express = require('express');
const roles = require('../../constants/roles');
const asyncHandler = require('../../utils/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const tenantValidation = require('../../middleware/tenantValidation');
const logsController = require('./controller');

const router = express.Router();
const residentLogsRouter = express.Router({ mergeParams: true });

router.use(authenticate);
router.use(tenantValidation);

router.post(
  '/',
  authorize([roles.ADMIN, roles.CARETAKER]),
  asyncHandler(logsController.createCareLog),
);

router.get(
  '/',
  authorize([roles.ADMIN, roles.CARETAKER, roles.GUARDIAN]),
  asyncHandler(logsController.listCareLogs),
);

router.get(
  '/:id',
  authorize([roles.ADMIN, roles.CARETAKER, roles.GUARDIAN]),
  asyncHandler(logsController.getCareLogById),
);

residentLogsRouter.use(authenticate);
residentLogsRouter.use(tenantValidation);

residentLogsRouter.get(
  '/',
  authorize([roles.ADMIN, roles.CARETAKER, roles.GUARDIAN]),
  asyncHandler(logsController.listResidentCareLogs),
);

module.exports = {
  router,
  residentLogsRouter,
};
