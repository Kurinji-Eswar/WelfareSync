const AppError = require('../../utils/AppError');
const repository = require('./repository');

const MAX_PAGE_SIZE = 100;

const validateRequiredString = (value, fieldName) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(`${fieldName} is required`, 400);
  }

  return value.trim();
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

const getRiskLevel = (welfareIndex) => {
  if (welfareIndex < 40) return 'HIGH';
  if (welfareIndex < 70) return 'MEDIUM';
  return 'LOW';
};

const getOverview = async ({ tenantId }) => {
  const normalizedTenantId = validateRequiredString(tenantId, 'tenantId');

  return repository.getOverview({ tenantId: normalizedTenantId });
};

const listResidents = async ({ tenantId, query }) => {
  const normalizedTenantId = validateRequiredString(tenantId, 'tenantId');
  const residents = await repository.listResidentsWithAnalytics({
    tenantId: normalizedTenantId,
    ...getPagination(query),
  });

  return residents.map(({ resident, analytics }) => {
    const welfareIndex = analytics ? analytics.welfareIndex : 0;

    return {
      resident,
      welfareIndex,
      riskLevel: getRiskLevel(welfareIndex),
    };
  });
};

const listNotifications = async ({ tenantId, query }) => {
  const normalizedTenantId = validateRequiredString(tenantId, 'tenantId');

  return repository.listNotifications({
    tenantId: normalizedTenantId,
    ...getPagination(query),
  });
};

const getResidentDashboard = async ({ tenantId, residentId, query }) => {
  const normalizedTenantId = validateRequiredString(tenantId, 'tenantId');
  const normalizedResidentId = validateRequiredString(residentId, 'residentId');
  const residentDashboard = await repository.findResidentDashboard({
    tenantId: normalizedTenantId,
    residentId: normalizedResidentId,
  });

  if (!residentDashboard) {
    throw new AppError('Resident not found', 404);
  }

  const notifications = await repository.listResidentNotifications({
    tenantId: normalizedTenantId,
    residentId: normalizedResidentId,
    ...getPagination(query),
  });

  return {
    resident: residentDashboard.resident,
    analytics: residentDashboard.analytics,
    notifications,
  };
};

module.exports = {
  getOverview,
  listResidents,
  listNotifications,
  getResidentDashboard,
};
