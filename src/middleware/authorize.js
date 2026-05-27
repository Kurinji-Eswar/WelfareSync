const roles = require('../constants/roles');
const AppError = require('../utils/AppError');

const VALID_ROLES = new Set(Object.values(roles));

const authorize = (allowedRoles = []) => {
  const normalizedRoles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  normalizedRoles.forEach((role) => {
    if (!VALID_ROLES.has(role)) {
      throw new AppError(`Invalid role configured for authorization: ${role}`, 500);
    }
  });

  return (req, res, next) => {
    try {
      if (!req.auth || !req.auth.role) {
        throw new AppError('Authentication is required', 401);
      }

      if (!normalizedRoles.includes(req.auth.role)) {
        throw new AppError('Insufficient permissions', 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = authorize;
