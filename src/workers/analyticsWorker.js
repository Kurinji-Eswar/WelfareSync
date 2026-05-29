const CARE_LOG_TYPES = new Set(['medication', 'nutrition', 'vitals', 'activity']);
const analyticsService = require('../modules/analytics/service');

const validatePayload = (event) => {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    throw new Error('care-log-created event must be an object');
  }
};

const validateRequiredString = (value, fieldName) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${fieldName} is required`);
  }

  return value.trim();
};

const validateCareLogEvent = (event) => {
  validatePayload(event);

  const validatedEvent = {
    tenantId: validateRequiredString(event.tenantId, 'tenantId'),
    residentId: validateRequiredString(event.residentId, 'residentId'),
    logId: validateRequiredString(event.logId, 'logId'),
    type: validateRequiredString(event.type, 'type'),
    caretakerId: event.caretakerId ? validateRequiredString(event.caretakerId, 'caretakerId') : null,
    recordedAt: event.recordedAt,
  };

  if (!CARE_LOG_TYPES.has(validatedEvent.type)) {
    throw new Error('type is invalid');
  }

  return validatedEvent;
};

const processCareLogEvent = async (event) => {
  const validatedEvent = validateCareLogEvent(event);

  console.info('Analytics processing started', {
    tenantId: validatedEvent.tenantId,
    residentId: validatedEvent.residentId,
    logId: validatedEvent.logId,
    type: validatedEvent.type,
  });

  await analyticsService.computeResidentAnalytics({
    tenantId: validatedEvent.tenantId,
    residentId: validatedEvent.residentId,
  });

  console.info('Analytics processing completed', {
    tenantId: validatedEvent.tenantId,
    residentId: validatedEvent.residentId,
    logId: validatedEvent.logId,
    type: validatedEvent.type,
  });
};

module.exports = {
  processCareLogEvent,
};
