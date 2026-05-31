const roles = require('../../constants/roles');
const AppError = require('../../utils/AppError');
const repository = require('./repository');

const RESIDENT_STATUSES = new Set(['ACTIVE', 'ARCHIVED']);
const MAX_PAGE_SIZE = 100;

const normalizeResidentInput = (payload) => ({
  firstName: payload.firstName ?? payload.first_name,
  lastName: payload.lastName ?? payload.last_name,
  gender: payload.gender,
  dateOfBirth: payload.dateOfBirth ?? payload.date_of_birth,
  admissionDate: payload.admissionDate ?? payload.admission_date,
  status: payload.status,
  weightMedication: payload.weightMedication ?? payload.weight_medication,
  weightNutrition: payload.weightNutrition ?? payload.weight_nutrition,
  weightVitals: payload.weightVitals ?? payload.weight_vitals,
});

const validateRequiredResidentFields = (resident) => {
  const requiredFields = [
    'firstName',
    'lastName',
    'gender',
    'dateOfBirth',
    'admissionDate',
  ];
  const missingFields = requiredFields.filter((field) => !resident[field]);

  if (missingFields.length) {
    throw new AppError('Missing required resident fields', 400, { missingFields });
  }
};

const validateResidentStatus = (status) => {
  if (status && !RESIDENT_STATUSES.has(status)) {
    throw new AppError('Invalid resident status', 400);
  }
};

const validateResidentWeights = (resident) => {
  ['weightMedication', 'weightNutrition', 'weightVitals'].forEach((field) => {
    if (resident[field] === undefined) {
      return;
    }

    const value = Number(resident[field]);
    if (!Number.isFinite(value) || value < 0) {
      throw new AppError(`${field} must be a non-negative number`, 400);
    }

    resident[field] = value;
  });
};

const getPagination = ({ limit, offset }) => {
  const parsedLimit = Number(limit || 25);
  const parsedOffset = Number(offset || 0);

  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > MAX_PAGE_SIZE) {
    throw new AppError(`limit must be an integer between 1 and ${MAX_PAGE_SIZE}`, 400);
  }

  if (!Number.isInteger(parsedOffset) || parsedOffset < 0) {
    throw new AppError('offset must be a non-negative integer', 400);
  }

  return {
    limit: parsedLimit,
    offset: parsedOffset,
  };
};

const assertGuardianCanAccessResident = async ({ user, resident }) => {
  if (user.role !== roles.GUARDIAN) {
    return;
  }

  // Future Enhancement:
  // Implement guardian-to-resident assignment validation using tenant-scoped access control.
  throw new AppError('Guardian resident assignment validation is not implemented', 403, {
    residentId: resident.id,
  });
};

const createResident = async ({ tenantId, payload }) => {
  const resident = normalizeResidentInput(payload);

  validateRequiredResidentFields(resident);
  validateResidentStatus(resident.status);
  validateResidentWeights(resident);

  return repository.createResident({ tenantId, resident });
};

const listResidents = async ({ tenantId, query }) => {
  validateResidentStatus(query.status);

  return repository.listResidents({
    tenantId,
    status: query.status || 'ACTIVE',
    ...getPagination(query),
  });
};

const getResidentById = async ({ tenantId, residentId, user }) => {
  const resident = await repository.findResidentById({ tenantId, residentId });

  if (!resident) {
    throw new AppError('Resident not found', 404);
  }

  await assertGuardianCanAccessResident({ user, resident });

  return resident;
};

const updateResident = async ({ tenantId, residentId, payload }) => {
  const resident = normalizeResidentInput(payload);

  validateResidentStatus(resident.status);
  validateResidentWeights(resident);

  const updatedResident = await repository.updateResident({
    tenantId,
    residentId,
    resident,
  });

  if (!updatedResident) {
    throw new AppError('Resident not found', 404);
  }

  return updatedResident;
};

const archiveResident = async ({ tenantId, residentId }) => {
  const resident = await repository.archiveResident({ tenantId, residentId });

  if (!resident) {
    throw new AppError('Resident not found', 404);
  }

  return resident;
};

module.exports = {
  createResident,
  listResidents,
  getResidentById,
  updateResident,
  archiveResident,
};
