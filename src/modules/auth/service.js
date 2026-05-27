const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const roles = require('../../constants/roles');
const AppError = require('../../utils/AppError');
const repository = require('./repository');

const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const REFRESH_TOKEN_DAYS = Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 7);
const ALLOWED_ROLES = new Set(Object.values(roles));
const CREATABLE_ROLES = new Set([roles.CARETAKER, roles.GUARDIAN]);

const getRequiredEnv = (name) => {
  if (!process.env[name]) {
    throw new AppError(`${name} is required`, 500);
  }

  return process.env[name];
};

const getAccessSecret = () => getRequiredEnv('JWT_ACCESS_SECRET');
const getRefreshSecret = () => getRequiredEnv('JWT_REFRESH_SECRET');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const getRefreshExpiry = () => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);
  return expiresAt;
};

const ensureTenantIsActive = async (tenantId) => {
  const tenant = await repository.findTenantById(tenantId);

  if (!tenant || !tenant.isActive) {
    throw new AppError('Tenant is invalid or inactive', 403);
  }

  return tenant;
};

const assertActiveUser = (user) => {
  if (!user || user.status !== 'ACTIVE') {
    throw new AppError('User is inactive or suspended', 403);
  }
};

const signAccessToken = (user) => jwt.sign(
  {
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
    tokenVersion: user.tokenVersion,
  },
  getAccessSecret(),
  { expiresIn: ACCESS_TOKEN_EXPIRES_IN },
);

const signRefreshToken = (user) => jwt.sign(
  {
    userId: user.id,
    tenantId: user.tenantId,
    tokenVersion: user.tokenVersion,
  },
  getRefreshSecret(),
  { expiresIn: REFRESH_TOKEN_EXPIRES_IN },
);

const issueTokenPair = async (user) => {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  await repository.saveRefreshToken({
    userId: user.id,
    tenantId: user.tenantId,
    tokenHash: hashToken(refreshToken),
    tokenVersion: user.tokenVersion,
    expiresAt: getRefreshExpiry(),
  });

  return {
    accessToken,
    refreshToken,
  };
};

const createTenant = async ({ name, slug, admin }) => {
  if (!name || !slug || !admin || !admin.name || !admin.email || !admin.password) {
    throw new AppError('Tenant name, slug, and admin credentials are required', 400);
  }

  if (admin.password.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  const existingTenant = await repository.findTenantBySlug(slug);
  if (existingTenant) {
    throw new AppError('Tenant slug is already in use', 409);
  }

  const passwordHash = await bcrypt.hash(admin.password, 12);
  const result = await repository.createTenantWithAdmin({
    tenant: { name, slug },
    admin: {
      name: admin.name,
      email: admin.email,
      passwordHash,
    },
  });
  const tokens = await issueTokenPair(result.user);

  return { ...result, ...tokens };
};

const register = async ({ tenantId, name, email, password, role }) => {
  if (!tenantId || !name || !email || !password || !role) {
    throw new AppError('Tenant, name, email, password, and role are required', 400);
  }

  if (!CREATABLE_ROLES.has(role)) {
    throw new AppError('Only CARETAKER and GUARDIAN users can be registered here', 400);
  }

  if (password.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  await ensureTenantIsActive(tenantId);

  const existingUser = await repository.findUserByEmail({ tenantId, email });
  if (existingUser) {
    throw new AppError('Email is already registered for this tenant', 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await repository.createUser({
    tenantId,
    name,
    email,
    passwordHash,
    role,
  });

  return { user };
};

const login = async ({ tenantId, email, password }) => {
  if (!tenantId || !email || !password) {
    throw new AppError('Tenant, email, and password are required', 400);
  }

  await ensureTenantIsActive(tenantId);

  const userRecord = await repository.findUserByEmail({ tenantId, email });
  const passwordMatches = userRecord
    ? await bcrypt.compare(password, userRecord.password_hash)
    : false;

  if (!userRecord || !passwordMatches) {
    throw new AppError('Invalid email or password', 401);
  }

  const user = {
    id: userRecord.id,
    tenantId: userRecord.tenant_id,
    name: userRecord.name,
    email: userRecord.email,
    role: userRecord.role,
    status: userRecord.status,
    tokenVersion: userRecord.token_version,
    createdAt: userRecord.created_at,
    updatedAt: userRecord.updated_at,
  };

  assertActiveUser(user);

  const tokens = await issueTokenPair(user);
  return { user, ...tokens };
};

const verifyAccessToken = (accessToken) => {
  if (!accessToken) {
    throw new AppError('Access token is required', 401);
  }

  try {
    const decoded = jwt.verify(accessToken, getAccessSecret());

    if (!decoded.userId || !decoded.tenantId || !decoded.role || decoded.tokenVersion === undefined) {
      throw new AppError('Access token is missing required claims', 401);
    }

    if (!ALLOWED_ROLES.has(decoded.role)) {
      throw new AppError('Access token role is invalid', 401);
    }

    return decoded;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError('Invalid or expired access token', 401);
  }
};

const verifyRefreshToken = (refreshToken) => {
  if (!refreshToken) {
    throw new AppError('Refresh token is required', 400);
  }

  try {
    const decoded = jwt.verify(refreshToken, getRefreshSecret());

    if (!decoded.userId || !decoded.tenantId || decoded.tokenVersion === undefined) {
      throw new AppError('Refresh token is missing required claims', 401);
    }

    return decoded;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError('Invalid or expired refresh token', 401);
  }
};

const refresh = async (refreshToken) => {
  const decoded = verifyRefreshToken(refreshToken);
  const tokenHash = hashToken(refreshToken);
  const storedToken = await repository.consumeRefreshToken({
    tokenHash,
    userId: decoded.userId,
    tenantId: decoded.tenantId,
    tokenVersion: decoded.tokenVersion,
  });

  if (!storedToken) {
    throw new AppError('Invalid refresh token', 401);
  }

  await ensureTenantIsActive(decoded.tenantId);

  const user = await repository.findUserById({
    userId: decoded.userId,
    tenantId: decoded.tenantId,
  });

  assertActiveUser(user);

  if (user.tokenVersion !== decoded.tokenVersion) {
    throw new AppError('Refresh token has been revoked', 401);
  }

  const tokens = await issueTokenPair(user);
  return { user, ...tokens };
};

const logout = async (refreshToken) => {
  if (!refreshToken) {
    return;
  }

  const decoded = verifyRefreshToken(refreshToken);

  await repository.revokeRefreshToken({
    tokenHash: hashToken(refreshToken),
    userId: decoded.userId,
    tenantId: decoded.tenantId,
  });
};

const logoutAll = async ({ userId, tenantId }) => {
  await repository.revokeAllUserRefreshTokens({ userId, tenantId });
};

module.exports = {
  createTenant,
  register,
  login,
  refresh,
  logout,
  logoutAll,
  verifyAccessToken,
};
