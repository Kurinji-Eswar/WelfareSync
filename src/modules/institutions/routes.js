const express = require('express');
const roles = require('../../constants/roles');
const asyncHandler = require('../../utils/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const tenantValidation = require('../../middleware/tenantValidation');
const institutionsController = require('./controller');

const router = express.Router();

router.use(authenticate);
router.use(tenantValidation);

router.post(
  '/',
  authorize([roles.ADMIN]),
  asyncHandler(institutionsController.createInstitution),
);

router.get(
  '/',
  authorize([roles.ADMIN, roles.CARETAKER, roles.GUARDIAN]),
  asyncHandler(institutionsController.listInstitutions),
);

router.get(
  '/:id',
  authorize([roles.ADMIN, roles.CARETAKER, roles.GUARDIAN]),
  asyncHandler(institutionsController.getInstitutionById),
);

router.put(
  '/:id',
  authorize([roles.ADMIN]),
  asyncHandler(institutionsController.updateInstitution),
);

router.delete(
  '/:id',
  authorize([roles.ADMIN]),
  asyncHandler(institutionsController.archiveInstitution),
);

module.exports = {
  router,
};
