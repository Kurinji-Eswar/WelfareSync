const AppError = require('../../utils/AppError');
const residentsRepository = require('../residents/repository');
const repository = require('./repository');

const NOTIFICATION_TYPES = new Set(['LOW_WELFARE_SCORE']);
const NOTIFICATION_STATUSES = new Set(['UNREAD', 'READ']);
const MAX_PAGE_SIZE = 100;

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

const validateStatus = (status) => {
  if (status && !NOTIFICATION_STATUSES.has(status)) {
    throw new AppError('Invalid notification status', 400);
  }
};

const validateNotificationType = (type) => {
  if (!NOTIFICATION_TYPES.has(type)) {
    throw new AppError('Invalid notification type', 400);
  }
};

const ensureResidentExists = async ({ tenantId, residentId }) => {
  const resident = await residentsRepository.findResidentById({ tenantId, residentId });

  if (!resident || resident.status === 'ARCHIVED') {
    throw new AppError('Resident not found', 404);
  }

  return resident;
};

const createNotification = async ({
  tenantId,
  residentId,
  type,
  title,
  message,
}) => {
  const normalizedTenantId = validateRequiredString(tenantId, 'tenantId');
  const normalizedResidentId = validateRequiredString(residentId, 'residentId');
  const normalizedType = validateRequiredString(type, 'type');
  const normalizedTitle = validateRequiredString(title, 'title');
  const normalizedMessage = validateRequiredString(message, 'message');

  validateNotificationType(normalizedType);
  await ensureResidentExists({
    tenantId: normalizedTenantId,
    residentId: normalizedResidentId,
  });

  return repository.createNotification({
    tenantId: normalizedTenantId,
    residentId: normalizedResidentId,
    type: normalizedType,
    title: normalizedTitle,
    message: normalizedMessage,
  });
};

const createLowWelfareScoreNotification = async ({ tenantId, residentId }) => (
  createNotification({
    tenantId,
    residentId,
    type: 'LOW_WELFARE_SCORE',
    title: 'Resident Welfare Warning',
    message: 'Resident welfare index dropped below threshold.',
  })
);

const listNotifications = async ({ tenantId, query }) => {
  const normalizedTenantId = validateRequiredString(tenantId, 'tenantId');
  const status = validateOptionalString(query.status, 'status');

  validateStatus(status);

  return repository.listNotifications({
    tenantId: normalizedTenantId,
    status,
    ...getPagination(query),
  });
};

const listResidentNotifications = async ({ tenantId, residentId, query }) => {
  const normalizedTenantId = validateRequiredString(tenantId, 'tenantId');
  const normalizedResidentId = validateRequiredString(residentId, 'residentId');
  const status = validateOptionalString(query.status, 'status');

  validateStatus(status);
  await ensureResidentExists({
    tenantId: normalizedTenantId,
    residentId: normalizedResidentId,
  });

  return repository.listResidentNotifications({
    tenantId: normalizedTenantId,
    residentId: normalizedResidentId,
    status,
    ...getPagination(query),
  });
};

const markNotificationAsRead = async ({ tenantId, notificationId }) => {
  const normalizedTenantId = validateRequiredString(tenantId, 'tenantId');
  const normalizedNotificationId = validateRequiredString(notificationId, 'notificationId');
  const notification = await repository.markNotificationAsRead({
    tenantId: normalizedTenantId,
    notificationId: normalizedNotificationId,
  });

  if (!notification) {
    throw new AppError('Notification not found', 404);
  }

  return notification;
};

module.exports = {
  createNotification,
  createLowWelfareScoreNotification,
  listNotifications,
  listResidentNotifications,
  markNotificationAsRead,
};
