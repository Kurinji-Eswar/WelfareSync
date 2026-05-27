const express = require('express');
const roles = require('../../constants/roles');
const asyncHandler = require('../../utils/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const tenantValidation = require('../../middleware/tenantValidation');
const residentsController = require('./controller');

const router = express.Router();

router.use(authenticate);
router.use(tenantValidation);

router.post(
  '/',
  authorize([roles.ADMIN]),
  asyncHandler(residentsController.createResident),
);

router.get(
  '/',
  authorize([roles.ADMIN, roles.CARETAKER]),
  asyncHandler(residentsController.listResidents),
);

router.get(
  '/:id',
  authorize([roles.ADMIN, roles.CARETAKER, roles.GUARDIAN]),
  asyncHandler(residentsController.getResidentById),
);

router.put(
  '/:id',
  authorize([roles.ADMIN]),
  asyncHandler(residentsController.updateResident),
);

router.delete(
  '/:id',
  authorize([roles.ADMIN]),
  asyncHandler(residentsController.archiveResident),
);

module.exports = {
  router,
};
