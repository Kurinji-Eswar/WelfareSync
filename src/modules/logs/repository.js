const { CareLog } = require('./models/CareLog');

const toCareLog = (document) => {
  if (!document) return null;

  const log = document.toObject ? document.toObject() : document;

  return {
    id: log._id.toString(),
    tenantId: log.tenantId,
    residentId: log.residentId,
    caretakerId: log.caretakerId,
    type: log.type,
    details: log.details,
    recordedAt: log.recordedAt,
    createdAt: log.createdAt,
    updatedAt: log.updatedAt,
  };
};

const createCareLog = async ({ tenantId, log }) => {
  const createdLog = await CareLog.create({
    tenantId,
    residentId: log.residentId,
    caretakerId: log.caretakerId,
    type: log.type,
    details: log.details,
    recordedAt: log.recordedAt,
  });

  return toCareLog(createdLog);
};

const listCareLogs = async ({
  tenantId,
  residentId,
  type,
  recordedFrom,
  recordedTo,
  limit,
  offset,
}) => {
  const filter = {
    tenantId,
  };

  if (residentId) {
    filter.residentId = residentId;
  }

  if (type) {
    filter.type = type;
  }

  if (recordedFrom || recordedTo) {
    filter.recordedAt = {};

    if (recordedFrom) {
      filter.recordedAt.$gte = recordedFrom;
    }

    if (recordedTo) {
      filter.recordedAt.$lte = recordedTo;
    }
  }

  const logs = await CareLog.find(filter)
    .sort({ recordedAt: -1, createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();

  return logs.map(toCareLog);
};

const findCareLogById = async ({ tenantId, logId }) => {
  const log = await CareLog.findOne({
    _id: logId,
    tenantId,
  }).lean();

  return toCareLog(log);
};

module.exports = {
  createCareLog,
  listCareLogs,
  findCareLogById,
};
