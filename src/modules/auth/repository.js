const { pool } = require('../../config/postgres');

const initializeAuthTables = async () => {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    CREATE TABLE IF NOT EXISTS tenants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(180) NOT NULL,
      slug VARCHAR(120) NOT NULL UNIQUE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(255) NOT NULL,
      password_hash TEXT NOT NULL,
      role VARCHAR(50) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      token_version INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT users_role_check CHECK (role IN ('ADMIN', 'CARETAKER', 'GUARDIAN')),
      CONSTRAINT users_status_check CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED'))
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      token_version INTEGER NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_email
      ON users(tenant_id, LOWER(email));
    CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_tenant_user ON refresh_tokens(tenant_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
  `);
};

const toTenant = (row) => {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const toPublicUser = (row) => {
  if (!row) return null;

  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    tokenVersion: row.token_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const createTenant = async ({ name, slug }) => {
  const result = await pool.query(
    `
      INSERT INTO tenants (name, slug)
      VALUES ($1, LOWER($2))
      RETURNING id, name, slug, is_active, created_at, updated_at
    `,
    [name, slug],
  );

  return toTenant(result.rows[0]);
};

const findTenantById = async (tenantId) => {
  const result = await pool.query(
    `
      SELECT id, name, slug, is_active, created_at, updated_at
      FROM tenants
      WHERE id = $1
    `,
    [tenantId],
  );

  return toTenant(result.rows[0]);
};

const findTenantBySlug = async (slug) => {
  const result = await pool.query(
    `
      SELECT id, name, slug, is_active, created_at, updated_at
      FROM tenants
      WHERE slug = LOWER($1)
    `,
    [slug],
  );

  return toTenant(result.rows[0]);
};

const createUser = async ({ tenantId, name, email, passwordHash, role }) => {
  const result = await pool.query(
    `
      INSERT INTO users (tenant_id, name, email, password_hash, role)
      VALUES ($1, $2, LOWER($3), $4, $5)
      RETURNING id, tenant_id, name, email, role, status, token_version, created_at, updated_at
    `,
    [tenantId, name, email, passwordHash, role],
  );

  return toPublicUser(result.rows[0]);
};

const createTenantWithAdmin = async ({ tenant, admin }) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const tenantResult = await client.query(
      `
        INSERT INTO tenants (name, slug)
        VALUES ($1, LOWER($2))
        RETURNING id, name, slug, is_active, created_at, updated_at
      `,
      [tenant.name, tenant.slug],
    );

    const createdTenant = tenantResult.rows[0];
    const userResult = await client.query(
      `
        INSERT INTO users (tenant_id, name, email, password_hash, role)
        VALUES ($1, $2, LOWER($3), $4, 'ADMIN')
        RETURNING id, tenant_id, name, email, role, status, token_version, created_at, updated_at
      `,
      [createdTenant.id, admin.name, admin.email, admin.passwordHash],
    );

    await client.query('COMMIT');

    return {
      tenant: toTenant(createdTenant),
      user: toPublicUser(userResult.rows[0]),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const findUserByEmail = async ({ tenantId, email }) => {
  const result = await pool.query(
    `
      SELECT id, tenant_id, name, email, password_hash, role, status, token_version, created_at, updated_at
      FROM users
      WHERE tenant_id = $1
        AND email = LOWER($2)
    `,
    [tenantId, email],
  );

  return result.rows[0] || null;
};

const findUserById = async ({ userId, tenantId }) => {
  const result = await pool.query(
    `
      SELECT id, tenant_id, name, email, role, status, token_version, created_at, updated_at
      FROM users
      WHERE id = $1
        AND tenant_id = $2
    `,
    [userId, tenantId],
  );

  return toPublicUser(result.rows[0]);
};

const saveRefreshToken = async ({
  userId,
  tenantId,
  tokenHash,
  tokenVersion,
  expiresAt,
}) => {
  const result = await pool.query(
    `
      INSERT INTO refresh_tokens (tenant_id, user_id, token_hash, token_version, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, tenant_id, user_id, token_hash, token_version, expires_at, revoked_at, created_at
    `,
    [tenantId, userId, tokenHash, tokenVersion, expiresAt],
  );

  return result.rows[0];
};

const consumeRefreshToken = async ({
  tokenHash,
  userId,
  tenantId,
  tokenVersion,
}) => {
  const result = await pool.query(
    `
      UPDATE refresh_tokens
      SET revoked_at = NOW()
      WHERE token_hash = $1
        AND user_id = $2
        AND tenant_id = $3
        AND token_version = $4
        AND revoked_at IS NULL
        AND expires_at > NOW()
      RETURNING id, tenant_id, user_id, token_hash, token_version, expires_at, revoked_at, created_at
    `,
    [tokenHash, userId, tenantId, tokenVersion],
  );

  return result.rows[0] || null;
};

const revokeRefreshToken = async ({ tokenHash, userId, tenantId }) => {
  await pool.query(
    `
      UPDATE refresh_tokens
      SET revoked_at = NOW()
      WHERE token_hash = $1
        AND user_id = $2
        AND tenant_id = $3
        AND revoked_at IS NULL
    `,
    [tokenHash, userId, tenantId],
  );
};

const revokeAllUserRefreshTokens = async ({ userId, tenantId }) => {
  await pool.query(
    `
      UPDATE refresh_tokens
      SET revoked_at = NOW()
      WHERE user_id = $1
        AND tenant_id = $2
        AND revoked_at IS NULL
    `,
    [userId, tenantId],
  );
};

module.exports = {
  pool,
  initializeAuthTables,
  createTenant,
  createTenantWithAdmin,
  findTenantById,
  findTenantBySlug,
  createUser,
  findUserByEmail,
  findUserById,
  saveRefreshToken,
  consumeRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
};
