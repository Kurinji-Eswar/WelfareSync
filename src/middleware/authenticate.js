const AppError = require('../utils/AppError');
const authService = require('../modules/auth/service');
const repository = require('../modules/auth/repository');

const authenticate = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization || '';
    const [, token] = authorization.match(/^Bearer\s+(.+)$/i) || [];
    const decoded = authService.verifyAccessToken(token);
    const user = await repository.findUserById({
      userId: decoded.userId,
      tenantId: decoded.tenantId,
    });

    if (!user) {
      throw new AppError('Authenticated user does not exist', 401);
    }

    if (user.status !== 'ACTIVE') {
      throw new AppError('User is inactive or suspended', 403);
    }

    if (user.role !== decoded.role || user.tenantId !== decoded.tenantId) {
      throw new AppError('Token claims no longer match the authenticated user', 403);
    }

    if (user.tokenVersion !== decoded.tokenVersion) {
      throw new AppError('Token version is no longer valid', 403);
    }

    req.auth = {
      userId: decoded.userId,
      tenantId: decoded.tenantId,
      role: decoded.role,
      tokenVersion: decoded.tokenVersion,
    };
    req.user = user;

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = authenticate;
