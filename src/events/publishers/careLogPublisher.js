const { getRedisPublisher } = require('../../config/redis');

const CARE_LOG_CREATED_CHANNEL = 'care-log-created';
const CARE_LOG_TYPES = new Set(['medication', 'nutrition', 'vitals', 'activity']);

const validatePayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('care-log-created payload must be an object');
  }
};

const validateRequiredString = (value, fieldName) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${fieldName} is required`);
  }

  return value.trim();
};

const validateCareLogCreatedPayload = (payload) => {
  validatePayload(payload);

  const event = {
    tenantId: validateRequiredString(payload.tenantId, 'tenantId'),
    residentId: validateRequiredString(payload.residentId, 'residentId'),
    caretakerId: validateRequiredString(payload.caretakerId, 'caretakerId'),
    logId: validateRequiredString(payload.logId, 'logId'),
    type: validateRequiredString(payload.type, 'type'),
    recordedAt: payload.recordedAt,
  };

  if (!CARE_LOG_TYPES.has(event.type)) {
    throw new Error('type is invalid');
  }

  const recordedAt = new Date(event.recordedAt);
  if (Number.isNaN(recordedAt.getTime())) {
    throw new Error('recordedAt must be a valid date');
  }

  event.recordedAt = recordedAt.toISOString();

  return event;
};

const publishCareLogCreated = async (payload) => {
  const event = validateCareLogCreatedPayload(payload);
  const publisher = getRedisPublisher();

  await publisher.publish(CARE_LOG_CREATED_CHANNEL, JSON.stringify(event));
};

module.exports = {
  CARE_LOG_CREATED_CHANNEL,
  publishCareLogCreated,
};
