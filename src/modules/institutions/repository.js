const { pool } = require('../auth/repository');

const initializeInstitutionsTable = async () => {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    CREATE TABLE IF NOT EXISTS institutions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name VARCHAR(180) NOT NULL,
      darpan_id VARCHAR(120),
      address TEXT NOT NULL,
      contact_email VARCHAR(255) NOT NULL,
      contact_phone VARCHAR(40) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT institutions_status_check CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_institutions_tenant_darpan_id
      ON institutions(tenant_id, darpan_id)
      WHERE darpan_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_institutions_tenant_id ON institutions(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_institutions_tenant_status ON institutions(tenant_id, status);
  `);
};

const toInstitution = (row) => {
  if (!row) return null;

  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    darpanId: row.darpan_id,
    address: row.address,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const createInstitution = async ({ tenantId, institution }) => {
  const result = await pool.query(
    `
      INSERT INTO institutions (
        tenant_id,
        name,
        darpan_id,
        address,
        contact_email,
        contact_phone,
        status
      )
      VALUES ($1, $2, $3, $4, LOWER($5), $6, COALESCE($7, 'ACTIVE'))
      RETURNING
        id,
        tenant_id,
        name,
        darpan_id,
        address,
        contact_email,
        contact_phone,
        status,
        created_at,
        updated_at
    `,
    [
      tenantId,
      institution.name,
      institution.darpanId,
      institution.address,
      institution.contactEmail,
      institution.contactPhone,
      institution.status,
    ],
  );

  return toInstitution(result.rows[0]);
};

const listInstitutions = async ({ tenantId, status, limit, offset }) => {
  const result = await pool.query(
    `
      SELECT
        id,
        tenant_id,
        name,
        darpan_id,
        address,
        contact_email,
        contact_phone,
        status,
        created_at,
        updated_at
      FROM institutions
      WHERE tenant_id = $1
        AND ($2::VARCHAR IS NULL OR status = $2)
      ORDER BY created_at DESC
      LIMIT $3
      OFFSET $4
    `,
    [tenantId, status || null, limit, offset],
  );

  return result.rows.map(toInstitution);
};

const findInstitutionById = async ({ tenantId, institutionId }) => {
  const result = await pool.query(
    `
      SELECT
        id,
        tenant_id,
        name,
        darpan_id,
        address,
        contact_email,
        contact_phone,
        status,
        created_at,
        updated_at
      FROM institutions
      WHERE tenant_id = $1
        AND id = $2
    `,
    [tenantId, institutionId],
  );

  return toInstitution(result.rows[0]);
};

const findInstitutionByDarpanId = async ({ tenantId, darpanId }) => {
  const result = await pool.query(
    `
      SELECT
        id,
        tenant_id,
        name,
        darpan_id,
        address,
        contact_email,
        contact_phone,
        status,
        created_at,
        updated_at
      FROM institutions
      WHERE tenant_id = $1
        AND darpan_id = $2
    `,
    [tenantId, darpanId],
  );

  return toInstitution(result.rows[0]);
};

const updateInstitution = async ({ tenantId, institutionId, institution }) => {
  const result = await pool.query(
    `
      UPDATE institutions
      SET
        name = COALESCE($3, name),
        darpan_id = COALESCE($4, darpan_id),
        address = COALESCE($5, address),
        contact_email = COALESCE(LOWER($6), contact_email),
        contact_phone = COALESCE($7, contact_phone),
        status = COALESCE($8, status),
        updated_at = NOW()
      WHERE tenant_id = $1
        AND id = $2
      RETURNING
        id,
        tenant_id,
        name,
        darpan_id,
        address,
        contact_email,
        contact_phone,
        status,
        created_at,
        updated_at
    `,
    [
      tenantId,
      institutionId,
      institution.name,
      institution.darpanId,
      institution.address,
      institution.contactEmail,
      institution.contactPhone,
      institution.status,
    ],
  );

  return toInstitution(result.rows[0]);
};

const archiveInstitution = async ({ tenantId, institutionId }) => {
  const result = await pool.query(
    `
      UPDATE institutions
      SET
        status = 'ARCHIVED',
        updated_at = NOW()
      WHERE tenant_id = $1
        AND id = $2
      RETURNING
        id,
        tenant_id,
        name,
        darpan_id,
        address,
        contact_email,
        contact_phone,
        status,
        created_at,
        updated_at
    `,
    [tenantId, institutionId],
  );

  return toInstitution(result.rows[0]);
};

module.exports = {
  initializeInstitutionsTable,
  createInstitution,
  listInstitutions,
  findInstitutionById,
  findInstitutionByDarpanId,
  updateInstitution,
  archiveInstitution,
};
