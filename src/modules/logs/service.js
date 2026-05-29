const mongoose = require('mongoose');
const roles = require('../../constants/roles');
const AppError = require('../../utils/AppError');
const { publishCareLogCreated } = require('../../events/publishers/careLogPublisher');
const residentsRepository = require('../residents/repository');
const repository = require('./repository');
const { CARE_LOG_TYPES } = require('./models/CareLog');

const MAX_PAGE_SIZE = 100;
const VALID_LOG_TYPES = new Set(CARE_LOG_TYPES);

const isPlainObject = (value) => (
  value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
  && Object.getPrototypeOf(value) === Object.prototype
);

const normalizeCareLogInput = (payload) => ({
  residentId: payload.residentId ?? payload.resident_id,
  caretakerId: payload.caretakerId ?? payload.caretaker_id,
  type: payload.type,
  details: payload.details,
  recordedAt: payload.recordedAt ?? payload.recorded_at,
});

const validateRequiredString = (value, fieldName) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(`${fieldName} is required`, 400);
  }

  return value.trim();
};

const validateOptionalString = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(`${fieldName} must be a string`, 400);
  }

  return value.trim();
};

const parseDate = (value, fieldName) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`${fieldName} must be a valid date`, 400);
  }

  return date;
};

const getPagination = ({ limit, offset }) => {
  if (
    (limit !== undefined && typeof limit === 'object')
    || (offset !== undefined && typeof offset === 'object')
  ) {
    throw new AppError('Pagination values must be scalar', 400);
  }

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

const validateLogType = (type) => {
  if (type !== undefined && type !== null && typeof type !== 'string') {
    throw new AppError('type must be a string', 400);
  }

  if (type && !VALID_LOG_TYPES.has(type)) {
    throw new AppError('Invalid care log type', 400, {
      allowedTypes: CARE_LOG_TYPES,
    });
  }
};

const validateDetails = (details) => {
  if (!isPlainObject(details)) {
    throw new AppError('details must be a non-empty object', 400);
  }

  if (!Object.keys(details).length) {
    throw new AppError('details must be a non-empty object', 400);
  }

  const containsUnsafeMongoKey = (value) => {
    if (!isPlainObject(value)) {
      return false;
    }

    return Object.entries(value).some(([key, childValue]) => (
      key.startsWith('$')
      || key.includes('.')
      || containsUnsafeMongoKey(childValue)
    ));
  };

  if (containsUnsafeMongoKey(details)) {
    throw new AppError('details contains unsafe keys', 400);
  }
};

const validateTenantId = (tenantId) => validateRequiredString(tenantId, 'tenantId');
const validateResidentId = (residentId) => validateRequiredString(residentId, 'residentId');
const validateCaretakerId = (caretakerId) => validateRequiredString(caretakerId, 'caretakerId');

const validateLogId = (logId) => {
  const normalizedLogId = validateRequiredString(logId, 'logId');

  if (!mongoose.Types.ObjectId.isValid(normalizedLogId)) {
    throw new AppError('Invalid log id', 400);
  }

  return normalizedLogId;
};

const ensureResidentExists = async ({ tenantId, residentId }) => {
  const resident = await residentsRepository.findResidentById({ tenantId, residentId });

  if (!resident || resident.status === 'ARCHIVED') {
    throw new AppError('Resident not found', 404);
  }

  return resident;
};

const assertGuardianCanAccessResidentLogs = async ({ user, residentId }) => {
  if (user.role !== roles.GUARDIAN) {
    return;
  }

  // TODO: Replace this fail-closed placeholder with a guardian_residents tenant-scoped assignment check.
  throw new AppError('Guardian resident log assignment validation is not implemented', 403, {
    residentId,
  });
};

const createCareLog = async ({ tenantId, user, payload }) => {
  const normalizedTenantId = validateTenantId(tenantId);
  const log = normalizeCareLogInput(payload);

  log.residentId = validateResidentId(log.residentId);
  log.caretakerId = validateCaretakerId(log.caretakerId);
  log.type = validateRequiredString(log.type, 'type');
  validateLogType(log.type);
  validateDetails(log.details);

  if (!log.recordedAt) {
    throw new AppError('recordedAt is required', 400);
  }

  log.recordedAt = parseDate(log.recordedAt, 'recordedAt');

  await ensureResidentExists({ tenantId: normalizedTenantId, residentId: log.residentId });

  const createdLog = await repository.createCareLog({ tenantId: normalizedTenantId, log });

  try {
    await publishCareLogCreated({
      tenantId: createdLog.tenantId,
      residentId: createdLog.residentId,
      caretakerId: createdLog.caretakerId,
      logId: createdLog.id,
      type: createdLog.type,
      recordedAt: createdLog.recordedAt,
    });
  } catch (error) {
    console.error('Failed to publish care-log-created event', {
      tenantId: createdLog.tenantId,
      residentId: createdLog.residentId,
      logId: createdLog.id,
      error,
    });
  }

  return createdLog;
};

const listCareLogs = async ({ tenantId, user, query }) => {
  const normalizedTenantId = validateTenantId(tenantId);
  const type = validateOptionalString(query.type, 'type');
  const residentId = validateOptionalString(query.residentId ?? query.resident_id, 'residentId');

  validateLogType(type);

  const recordedFrom = parseDate(query.recordedFrom ?? query.recorded_from, 'recordedFrom');
  const recordedTo = parseDate(query.recordedTo ?? query.recorded_to, 'recordedTo');

  if (recordedFrom && recordedTo && recordedFrom > recordedTo) {
    throw new AppError('recordedFrom must be before recordedTo', 400);
  }

  if (residentId) {
    await assertGuardianCanAccessResidentLogs({
      user,
      residentId,
    });
  }

  return repository.listCareLogs({
    tenantId: normalizedTenantId,
    residentId,
    type,
    recordedFrom,
    recordedTo,
    ...getPagination(query),
  });
};

const getCareLogById = async ({ tenantId, user, logId }) => {
  const normalizedTenantId = validateTenantId(tenantId);
  const normalizedLogId = validateLogId(logId);

  const log = await repository.findCareLogById({
    tenantId: normalizedTenantId,
    logId: normalizedLogId,
  });

  if (!log) {
    throw new AppError('Care log not found', 404);
  }

  await assertGuardianCanAccessResidentLogs({
    user,
    residentId: log.residentId,
  });

  return log;
};

const listResidentCareLogs = async ({ tenantId, user, residentId, query }) => {
  const normalizedTenantId = validateTenantId(tenantId);
  const normalizedResidentId = validateResidentId(residentId);
  const type = validateOptionalString(query.type, 'type');

  validateLogType(type);
  await ensureResidentExists({ tenantId: normalizedTenantId, residentId: normalizedResidentId });
  await assertGuardianCanAccessResidentLogs({ user, residentId: normalizedResidentId });

  const recordedFrom = parseDate(query.recordedFrom ?? query.recorded_from, 'recordedFrom');
  const recordedTo = parseDate(query.recordedTo ?? query.recorded_to, 'recordedTo');

  if (recordedFrom && recordedTo && recordedFrom > recordedTo) {
    throw new AppError('recordedFrom must be before recordedTo', 400);
  }

  return repository.listCareLogs({
    tenantId: normalizedTenantId,
    residentId: normalizedResidentId,
    type,
    recordedFrom,
    recordedTo,
    ...getPagination(query),
  });
};

module.exports = {
  createCareLog,
  listCareLogs,
  getCareLogById,
  listResidentCareLogs,
};
