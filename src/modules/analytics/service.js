const AppError = require('../../utils/AppError');
const residentsRepository = require('../residents/repository');
const logsRepository = require('../logs/repository');
const notificationsService = require('../notifications/service');
const repository = require('./repository');

const LOG_TYPES = ['medication', 'nutrition', 'vitals', 'activity'];
const ANALYTICS_LOG_LIMIT = Number(process.env.ANALYTICS_LOG_LIMIT || 1000);

const validateRequiredString = (value, fieldName) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(`${fieldName} is required`, 400);
  }

  return value.trim();
};

const clampScore = (score) => Math.max(0, Math.min(100, Number(score.toFixed(2))));

const getExplicitScore = (log) => {
  const score = log.details && Number(log.details.score);

  if (Number.isFinite(score)) {
    return clampScore(score);
  }

  return null;
};

const getRecencyScore = (log) => {
  const recordedAt = new Date(log.recordedAt).getTime();
  const ageDays = (Date.now() - recordedAt) / (1000 * 60 * 60 * 24);

  if (ageDays <= 1) return 100;
  if (ageDays <= 3) return 85;
  if (ageDays <= 7) return 70;
  if (ageDays <= 14) return 50;
  return 25;
};

const calculateTypeScore = (logs) => {
  if (!logs.length) {
    return 0;
  }

  const explicitScores = logs
    .map(getExplicitScore)
    .filter((score) => score !== null);

  if (explicitScores.length) {
    const total = explicitScores.reduce((sum, score) => sum + score, 0);
    return clampScore(total / explicitScores.length);
  }

  return clampScore(Math.max(...logs.map(getRecencyScore)));
};

const calculateScores = (logs) => {
  const logsByType = LOG_TYPES.reduce((groupedLogs, type) => ({
    ...groupedLogs,
    [type]: logs.filter((log) => log.type === type),
  }), {});

  return {
    medicationScore: calculateTypeScore(logsByType.medication),
    nutritionScore: calculateTypeScore(logsByType.nutrition),
    vitalsScore: calculateTypeScore(logsByType.vitals),
    activityScore: calculateTypeScore(logsByType.activity),
  };
};

const calculateWelfareIndex = ({ resident, scores }) => {
  const weightMedication = Number(resident.weightMedication);
  const weightNutrition = Number(resident.weightNutrition);
  const weightVitals = Number(resident.weightVitals);
  const totalWeight = weightMedication + weightNutrition + weightVitals;

  if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
    return 0;
  }

  return clampScore(
    (
      (weightMedication * scores.medicationScore)
      + (weightNutrition * scores.nutritionScore)
      + (weightVitals * scores.vitalsScore)
    ) / totalWeight,
  );
};

const getResidentOrThrow = async ({ tenantId, residentId }) => {
  const resident = await residentsRepository.findResidentById({ tenantId, residentId });

  if (!resident || resident.status === 'ARCHIVED') {
    throw new AppError('Resident not found', 404);
  }

  return resident;
};

const computeResidentAnalytics = async ({ tenantId, residentId }) => {
  const normalizedTenantId = validateRequiredString(tenantId, 'tenantId');
  const normalizedResidentId = validateRequiredString(residentId, 'residentId');
  const resident = await getResidentOrThrow({
    tenantId: normalizedTenantId,
    residentId: normalizedResidentId,
  });
  const logs = await logsRepository.listCareLogs({
    tenantId: normalizedTenantId,
    residentId: normalizedResidentId,
    limit: ANALYTICS_LOG_LIMIT,
    offset: 0,
  });
  const scores = calculateScores(logs);
  const welfareIndex = calculateWelfareIndex({ resident, scores });

  const analytics = await repository.upsertResidentAnalytics({
    tenantId: normalizedTenantId,
    residentId: normalizedResidentId,
    ...scores,
    welfareIndex,
  });

  return {
    resident,
    analytics,
  };
};

const getResidentAnalytics = async ({ tenantId, residentId }) => {
  const normalizedTenantId = validateRequiredString(tenantId, 'tenantId');
  const normalizedResidentId = validateRequiredString(residentId, 'residentId');
  const resident = await getResidentOrThrow({
    tenantId: normalizedTenantId,
    residentId: normalizedResidentId,
  });

  let analytics = await repository.findResidentAnalytics({
    tenantId: normalizedTenantId,
    residentId: normalizedResidentId,
  });

  if (!analytics) {
    ({ analytics } = await computeResidentAnalytics({
      tenantId: normalizedTenantId,
      residentId: normalizedResidentId,
    }));
  }

  return {
    resident,
    scores: analytics.scores,
    welfareIndex: analytics.welfareIndex,
    updatedAt: analytics.updatedAt,
  };
};

// TEMPORARY TEST ROUTE.
const testLowScoreNotification = async ({ tenantId, residentId }) => {
  const { resident, analytics } = await computeResidentAnalytics({ tenantId, residentId });
  const forcedAnalytics = await repository.upsertResidentAnalytics({
    tenantId: analytics.tenantId,
    residentId: analytics.residentId,
    medicationScore: analytics.scores.medication,
    nutritionScore: analytics.scores.nutrition,
    vitalsScore: analytics.scores.vitals,
    activityScore: analytics.scores.activity,
    welfareIndex: 25,
  });
  const notification = await notificationsService.createLowWelfareScoreNotification({
    tenantId: analytics.tenantId,
    residentId: analytics.residentId,
  });

  return {
    resident,
    scores: forcedAnalytics.scores,
    welfareIndex: forcedAnalytics.welfareIndex,
    notification,
  };
};

module.exports = {
  computeResidentAnalytics,
  getResidentAnalytics,
  testLowScoreNotification,
};
