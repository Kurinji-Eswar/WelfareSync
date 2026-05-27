const AppError = require('../utils/AppError');

const tenantValidation = (req, res, next) => {
  try {
    const tenantId = req.headers['x-tenant-id'];

    if (!tenantId) {
      throw new AppError('X-Tenant-ID header is required', 400);
    }

    if (!req.auth || !req.auth.tenantId) {
      throw new AppError('Authentication is required for tenant validation', 401);
    }

    if (tenantId !== req.auth.tenantId) {
      throw new AppError('Tenant access denied', 403);
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = tenantValidation;
