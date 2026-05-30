const analyticsService = require('./service');

const sendResponse = (res, statusCode, data) => {
  res.status(statusCode).json({
    success: true,
    data,
  });
};

const getResidentAnalytics = async (req, res) => {
  const result = await analyticsService.getResidentAnalytics({
    tenantId: req.auth.tenantId,
    residentId: req.params.residentId,
  });

  sendResponse(res, 200, result);
};

// TEMPORARY TEST ROUTE.
const testLowScoreNotification = async (req, res) => {
  const result = await analyticsService.testLowScoreNotification({
    tenantId: req.auth.tenantId,
    residentId: req.params.residentId,
  });

  sendResponse(res, 201, result);
};

module.exports = {
  getResidentAnalytics,
  testLowScoreNotification,
};
