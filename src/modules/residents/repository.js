const { pool } = require('../auth/repository');

const initializeResidentsTable = async () => {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    CREATE TABLE IF NOT EXISTS residents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      first_name VARCHAR(120) NOT NULL,
      last_name VARCHAR(120) NOT NULL,
      gender VARCHAR(30) NOT NULL,
      date_of_birth DATE NOT NULL,
      admission_date DATE NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
      weight_medication NUMERIC(8, 3) NOT NULL DEFAULT 1,
      weight_nutrition NUMERIC(8, 3) NOT NULL DEFAULT 1,
      weight_vitals NUMERIC(8, 3) NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT residents_status_check CHECK (status IN ('ACTIVE', 'ARCHIVED')),
      CONSTRAINT residents_weight_medication_check CHECK (weight_medication >= 0),
      CONSTRAINT residents_weight_nutrition_check CHECK (weight_nutrition >= 0),
      CONSTRAINT residents_weight_vitals_check CHECK (weight_vitals >= 0)
    );

    CREATE INDEX IF NOT EXISTS idx_residents_tenant_id ON residents(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_residents_tenant_status ON residents(tenant_id, status);
  `);
};

const toResident = (row) => {
  if (!row) return null;

  return {
    id: row.id,
    tenantId: row.tenant_id,
    firstName: row.first_name,
    lastName: row.last_name,
    gender: row.gender,
    dateOfBirth: row.date_of_birth,
    admissionDate: row.admission_date,
    status: row.status,
    weightMedication: Number(row.weight_medication),
    weightNutrition: Number(row.weight_nutrition),
    weightVitals: Number(row.weight_vitals),
    createdAt: row.created_at,
  };
};

const createResident = async ({ tenantId, resident }) => {
  const result = await pool.query(
    `
      INSERT INTO residents (
        tenant_id,
        first_name,
        last_name,
        gender,
        date_of_birth,
        admission_date,
        status,
        weight_medication,
        weight_nutrition,
        weight_vitals
      )
      VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'ACTIVE'), COALESCE($8, 1), COALESCE($9, 1), COALESCE($10, 1))
      RETURNING
        id,
        tenant_id,
        first_name,
        last_name,
        gender,
        date_of_birth,
        admission_date,
        status,
        weight_medication,
        weight_nutrition,
        weight_vitals,
        created_at
    `,
    [
      tenantId,
      resident.firstName,
      resident.lastName,
      resident.gender,
      resident.dateOfBirth,
      resident.admissionDate,
      resident.status,
      resident.weightMedication,
      resident.weightNutrition,
      resident.weightVitals,
    ],
  );

  return toResident(result.rows[0]);
};

const listResidents = async ({ tenantId, status, limit, offset }) => {
  const result = await pool.query(
    `
      SELECT
        id,
        tenant_id,
        first_name,
        last_name,
        gender,
        date_of_birth,
        admission_date,
        status,
        weight_medication,
        weight_nutrition,
        weight_vitals,
        created_at
      FROM residents
      WHERE tenant_id = $1
        AND ($2::VARCHAR IS NULL OR status = $2)
      ORDER BY created_at DESC
      LIMIT $3
      OFFSET $4
    `,
    [tenantId, status || null, limit, offset],
  );

  return result.rows.map(toResident);
};

const findResidentById = async ({ tenantId, residentId }) => {
  const result = await pool.query(
    `
      SELECT
        id,
        tenant_id,
        first_name,
        last_name,
        gender,
        date_of_birth,
        admission_date,
        status,
        weight_medication,
        weight_nutrition,
        weight_vitals,
        created_at
      FROM residents
      WHERE tenant_id = $1
        AND id = $2
    `,
    [tenantId, residentId],
  );

  return toResident(result.rows[0]);
};

const updateResident = async ({ tenantId, residentId, resident }) => {
  const result = await pool.query(
    `
      UPDATE residents
      SET
        first_name = COALESCE($3, first_name),
        last_name = COALESCE($4, last_name),
        gender = COALESCE($5, gender),
        date_of_birth = COALESCE($6, date_of_birth),
        admission_date = COALESCE($7, admission_date),
        status = COALESCE($8, status),
        weight_medication = COALESCE($9, weight_medication),
        weight_nutrition = COALESCE($10, weight_nutrition),
        weight_vitals = COALESCE($11, weight_vitals)
      WHERE tenant_id = $1
        AND id = $2
      RETURNING
        id,
        tenant_id,
        first_name,
        last_name,
        gender,
        date_of_birth,
        admission_date,
        status,
        weight_medication,
        weight_nutrition,
        weight_vitals,
        created_at
    `,
    [
      tenantId,
      residentId,
      resident.firstName,
      resident.lastName,
      resident.gender,
      resident.dateOfBirth,
      resident.admissionDate,
      resident.status,
      resident.weightMedication,
      resident.weightNutrition,
      resident.weightVitals,
    ],
  );

  return toResident(result.rows[0]);
};

const archiveResident = async ({ tenantId, residentId }) => {
  const result = await pool.query(
    `
      UPDATE residents
      SET status = 'ARCHIVED'
      WHERE tenant_id = $1
        AND id = $2
      RETURNING
        id,
        tenant_id,
        first_name,
        last_name,
        gender,
        date_of_birth,
        admission_date,
        status,
        weight_medication,
        weight_nutrition,
        weight_vitals,
        created_at
    `,
    [tenantId, residentId],
  );

  return toResident(result.rows[0]);
};

module.exports = {
  initializeResidentsTable,
  createResident,
  listResidents,
  findResidentById,
  updateResident,
  archiveResident,
};
