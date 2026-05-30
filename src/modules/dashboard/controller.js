const dashboardService = require('./service');

const sendResponse = (res, statusCode, data) => {
  res.status(statusCode).json({
    success: true,
    data,
  });
};

const getOverview = async (req, res) => {
  const overview = await dashboardService.getOverview({
    tenantId: req.auth.tenantId,
  });

  sendResponse(res, 200, overview);
};

const listResidents = async (req, res) => {
  const residents = await dashboardService.listResidents({
    tenantId: req.auth.tenantId,
    query: req.query,
  });

  sendResponse(res, 200, { residents });
};

const listNotifications = async (req, res) => {
  const notifications = await dashboardService.listNotifications({
    tenantId: req.auth.tenantId,
    query: req.query,
  });

  sendResponse(res, 200, { notifications });
};

const getResidentDashboard = async (req, res) => {
  const dashboard = await dashboardService.getResidentDashboard({
    tenantId: req.auth.tenantId,
    residentId: req.params.residentId,
    query: req.query,
  });

  sendResponse(res, 200, dashboard);
};

module.exports = {
  getOverview,
  listResidents,
  listNotifications,
  getResidentDashboard,
};
