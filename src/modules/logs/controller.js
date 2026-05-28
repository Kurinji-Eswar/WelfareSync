const logsService = require('./service');

const sendResponse = (res, statusCode, data) => {
  res.status(statusCode).json({
    success: true,
    data,
  });
};

const createCareLog = async (req, res) => {
  const log = await logsService.createCareLog({
    tenantId: req.auth.tenantId,
    user: req.user,
    payload: req.body,
  });

  sendResponse(res, 201, { log });
};

const listCareLogs = async (req, res) => {
  const logs = await logsService.listCareLogs({
    tenantId: req.auth.tenantId,
    user: req.user,
    query: req.query,
  });

  sendResponse(res, 200, { logs });
};

const getCareLogById = async (req, res) => {
  const log = await logsService.getCareLogById({
    tenantId: req.auth.tenantId,
    user: req.user,
    logId: req.params.id,
  });

  sendResponse(res, 200, { log });
};

const listResidentCareLogs = async (req, res) => {
  const logs = await logsService.listResidentCareLogs({
    tenantId: req.auth.tenantId,
    user: req.user,
    residentId: req.params.residentId,
    query: req.query,
  });

  sendResponse(res, 200, { logs });
};

module.exports = {
  createCareLog,
  listCareLogs,
  getCareLogById,
  listResidentCareLogs,
};
