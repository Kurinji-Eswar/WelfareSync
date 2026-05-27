const AppError = require('../../utils/AppError');
const repository = require('./repository');

const INSTITUTION_STATUSES = new Set(['ACTIVE', 'INACTIVE', 'ARCHIVED']);
const MAX_PAGE_SIZE = 100;

const normalizeInstitutionInput = (payload) => ({
  name: payload.name,
  darpanId: payload.darpanId ?? payload.darpan_id,
  address: payload.address,
  contactEmail: payload.contactEmail ?? payload.contact_email,
  contactPhone: payload.contactPhone ?? payload.contact_phone,
  status: payload.status,
});

const validateRequiredFields = (institution) => {
  const requiredFields = ['name', 'address', 'contactEmail', 'contactPhone'];
  const missingFields = requiredFields.filter((field) => !institution[field]);

  if (missingFields.length) {
    throw new AppError('Missing required institution fields', 400, { missingFields });
  }
};

const validateStatus = (status) => {
  if (status && !INSTITUTION_STATUSES.has(status)) {
    throw new AppError('Invalid institution status', 400);
  }
};

const validateEmail = (email) => {
  if (!email) {
    return;
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    throw new AppError('Invalid contact email', 400);
  }
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

const ensureDarpanIdIsAvailable = async ({ tenantId, darpanId, ignoreInstitutionId = null }) => {
  if (!darpanId) {
    return;
  }

  const existingInstitution = await repository.findInstitutionByDarpanId({ tenantId, darpanId });
  if (existingInstitution && existingInstitution.id !== ignoreInstitutionId) {
    throw new AppError('DARPAN ID is already registered for this tenant', 409);
  }
};

const createInstitution = async ({ tenantId, payload }) => {
  const institution = normalizeInstitutionInput(payload);

  validateRequiredFields(institution);
  validateStatus(institution.status);
  validateEmail(institution.contactEmail);
  await ensureDarpanIdIsAvailable({ tenantId, darpanId: institution.darpanId });

  return repository.createInstitution({ tenantId, institution });
};

const listInstitutions = async ({ tenantId, query }) => {
  validateStatus(query.status);

  return repository.listInstitutions({
    tenantId,
    status: query.status || 'ACTIVE',
    ...getPagination(query),
  });
};

const getInstitutionById = async ({ tenantId, institutionId }) => {
  const institution = await repository.findInstitutionById({ tenantId, institutionId });

  if (!institution) {
    throw new AppError('Institution not found', 404);
  }

  return institution;
};

const updateInstitution = async ({ tenantId, institutionId, payload }) => {
  const institution = normalizeInstitutionInput(payload);

  validateStatus(institution.status);
  validateEmail(institution.contactEmail);
  await ensureDarpanIdIsAvailable({
    tenantId,
    darpanId: institution.darpanId,
    ignoreInstitutionId: institutionId,
  });

  const updatedInstitution = await repository.updateInstitution({
    tenantId,
    institutionId,
    institution,
  });

  if (!updatedInstitution) {
    throw new AppError('Institution not found', 404);
  }

  return updatedInstitution;
};

const archiveInstitution = async ({ tenantId, institutionId }) => {
  const institution = await repository.archiveInstitution({ tenantId, institutionId });

  if (!institution) {
    throw new AppError('Institution not found', 404);
  }

  return institution;
};

module.exports = {
  createInstitution,
  listInstitutions,
  getInstitutionById,
  updateInstitution,
  archiveInstitution,
};
