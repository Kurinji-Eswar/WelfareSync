const { pool } = require('../auth/repository');

const initializeAnalyticsTable = async () => {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    CREATE TABLE IF NOT EXISTS resident_analytics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
      medication_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
      nutrition_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
      vitals_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
      activity_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
      welfare_index NUMERIC(6, 2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT resident_analytics_scores_check CHECK (
        medication_score >= 0
        AND medication_score <= 100
        AND nutrition_score >= 0
        AND nutrition_score <= 100
        AND vitals_score >= 0
        AND vitals_score <= 100
        AND activity_score >= 0
        AND activity_score <= 100
        AND welfare_index >= 0
        AND welfare_index <= 100
      )
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_resident_analytics_tenant_resident
      ON resident_analytics(tenant_id, resident_id);
    CREATE INDEX IF NOT EXISTS idx_resident_analytics_tenant_id
      ON resident_analytics(tenant_id);
  `);
};

const toAnalytics = (row) => {
  if (!row) return null;

  return {
    id: row.id,
    tenantId: row.tenant_id,
    residentId: row.resident_id,
    scores: {
      medication: Number(row.medication_score),
      nutrition: Number(row.nutrition_score),
      vitals: Number(row.vitals_score),
      activity: Number(row.activity_score),
    },
    welfareIndex: Number(row.welfare_index),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const findResidentAnalytics = async ({ tenantId, residentId }) => {
  const result = await pool.query(
    `
      SELECT
        id,
        tenant_id,
        resident_id,
        medication_score,
        nutrition_score,
        vitals_score,
        activity_score,
        welfare_index,
        created_at,
        updated_at
      FROM resident_analytics
      WHERE tenant_id = $1
        AND resident_id = $2
    `,
    [tenantId, residentId],
  );

  return toAnalytics(result.rows[0]);
};

const upsertResidentAnalytics = async ({
  tenantId,
  residentId,
  medicationScore,
  nutritionScore,
  vitalsScore,
  activityScore,
  welfareIndex,
}) => {
  const result = await pool.query(
    `
      INSERT INTO resident_analytics (
        tenant_id,
        resident_id,
        medication_score,
        nutrition_score,
        vitals_score,
        activity_score,
        welfare_index
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (tenant_id, resident_id)
      DO UPDATE SET
        medication_score = EXCLUDED.medication_score,
        nutrition_score = EXCLUDED.nutrition_score,
        vitals_score = EXCLUDED.vitals_score,
        activity_score = EXCLUDED.activity_score,
        welfare_index = EXCLUDED.welfare_index,
        updated_at = NOW()
      RETURNING
        id,
        tenant_id,
        resident_id,
        medication_score,
        nutrition_score,
        vitals_score,
        activity_score,
        welfare_index,
        created_at,
        updated_at
    `,
    [
      tenantId,
      residentId,
      medicationScore,
      nutritionScore,
      vitalsScore,
      activityScore,
      welfareIndex,
    ],
  );

  return toAnalytics(result.rows[0]);
};

module.exports = {
  initializeAnalyticsTable,
  findResidentAnalytics,
  upsertResidentAnalytics,
};
