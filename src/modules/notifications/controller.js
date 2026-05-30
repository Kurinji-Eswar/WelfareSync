const notificationsService = require('./service');

const sendResponse = (res, statusCode, data) => {
  res.status(statusCode).json({
    success: true,
    data,
  });
};

const listNotifications = async (req, res) => {
  const notifications = await notificationsService.listNotifications({
    tenantId: req.auth.tenantId,
    query: req.query,
  });

  sendResponse(res, 200, { notifications });
};

const listResidentNotifications = async (req, res) => {
  const notifications = await notificationsService.listResidentNotifications({
    tenantId: req.auth.tenantId,
    residentId: req.params.residentId,
    query: req.query,
  });

  sendResponse(res, 200, { notifications });
};

const markNotificationAsRead = async (req, res) => {
  const notification = await notificationsService.markNotificationAsRead({
    tenantId: req.auth.tenantId,
    notificationId: req.params.id,
  });

  sendResponse(res, 200, { notification });
};

module.exports = {
  listNotifications,
  listResidentNotifications,
  markNotificationAsRead,
};
