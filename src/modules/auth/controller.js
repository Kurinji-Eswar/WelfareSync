const authService = require('./service');

const sendResponse = (res, statusCode, data) => {
  res.status(statusCode).json({
    success: true,
    data,
  });
};

const createTenant = async (req, res) => {
  const result = await authService.createTenant(req.body);
  sendResponse(res, 201, result);
};

const register = async (req, res) => {
  const result = await authService.register({
    ...req.body,
    tenantId: req.auth.tenantId,
  });

  sendResponse(res, 201, result);
};

const login = async (req, res) => {
  const result = await authService.login({
    ...req.body,
    tenantId: req.headers['x-tenant-id'] || req.body.tenantId,
  });

  sendResponse(res, 200, result);
};

const refresh = async (req, res) => {
  const result = await authService.refresh(req.body.refreshToken);
  sendResponse(res, 200, result);
};

const logout = async (req, res) => {
  await authService.logout(req.body.refreshToken);
  res.status(204).send();
};

const logoutAll = async (req, res) => {
  await authService.logoutAll({
    userId: req.auth.userId,
    tenantId: req.auth.tenantId,
  });
  res.status(204).send();
};

const me = async (req, res) => {
  sendResponse(res, 200, { user: req.user });
};

module.exports = {
  createTenant,
  register,
  login,
  refresh,
  logout,
  logoutAll,
  me,
};
