const { pool } = require('../auth/repository');

const toResident = (row) => ({
  id: row.id,
  tenantId: row.tenant_id,
  firstName: row.first_name,
  lastName: row.last_name,
  gender: row.gender,
  dateOfBirth: row.date_of_birth,
  admissionDate: row.admission_date,
  status: row.status,
  createdAt: row.created_at,
});

const toAnalytics = (row) => {
  if (!row || row.welfare_index === null || row.welfare_index === undefined) {
    return null;
  }

  return {
    scores: {
      medication: Number(row.medication_score || 0),
      nutrition: Number(row.nutrition_score || 0),
      vitals: Number(row.vitals_score || 0),
      activity: Number(row.activity_score || 0),
    },
    welfareIndex: Number(row.welfare_index || 0),
    updatedAt: row.analytics_updated_at,
  };
};

const toNotification = (row) => ({
  id: row.id,
  tenantId: row.tenant_id,
  residentId: row.resident_id,
  type: row.type,
  title: row.title,
  message: row.message,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const getOverview = async ({ tenantId }) => {
  const result = await pool.query(
    `
      SELECT
        COUNT(r.id)::INTEGER AS resident_count,
        COUNT(r.id) FILTER (WHERE r.status = 'ACTIVE')::INTEGER AS active_residents,
        COUNT(r.id) FILTER (WHERE ra.welfare_index < 40)::INTEGER AS high_risk_residents,
        COALESCE(AVG(ra.welfare_index), 0)::NUMERIC(6, 2) AS average_welfare_index,
        (
          SELECT COUNT(n.id)::INTEGER
          FROM notifications n
          WHERE n.tenant_id = $1
            AND n.status = 'UNREAD'
        ) AS unread_notifications
      FROM residents r
      LEFT JOIN resident_analytics ra
        ON ra.tenant_id = r.tenant_id
        AND ra.resident_id = r.id
      WHERE r.tenant_id = $1
    `,
    [tenantId],
  );

  const row = result.rows[0];

  return {
    residentCount: Number(row.resident_count || 0),
    activeResidents: Number(row.active_residents || 0),
    highRiskResidents: Number(row.high_risk_residents || 0),
    unreadNotifications: Number(row.unread_notifications || 0),
    averageWelfareIndex: Number(row.average_welfare_index || 0),
  };
};

const listResidentsWithAnalytics = async ({ tenantId, limit, offset }) => {
  const result = await pool.query(
    `
      SELECT
        r.id,
        r.tenant_id,
        r.first_name,
        r.last_name,
        r.gender,
        r.date_of_birth,
        r.admission_date,
        r.status,
        r.created_at,
        ra.medication_score,
        ra.nutrition_score,
        ra.vitals_score,
        ra.activity_score,
        ra.welfare_index,
        ra.updated_at AS analytics_updated_at
      FROM residents r
      LEFT JOIN resident_analytics ra
        ON ra.tenant_id = r.tenant_id
        AND ra.resident_id = r.id
      WHERE r.tenant_id = $1
      ORDER BY r.created_at DESC
      LIMIT $2
      OFFSET $3
    `,
    [tenantId, limit, offset],
  );

  return result.rows.map((row) => ({
    resident: toResident(row),
    analytics: toAnalytics(row),
  }));
};

const listNotifications = async ({ tenantId, limit, offset }) => {
  const result = await pool.query(
    `
      SELECT
        id,
        tenant_id,
        resident_id,
        type,
        title,
        message,
        status,
        created_at,
        updated_at
      FROM notifications
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT $2
      OFFSET $3
    `,
    [tenantId, limit, offset],
  );

  return result.rows.map(toNotification);
};

const findResidentDashboard = async ({ tenantId, residentId }) => {
  const result = await pool.query(
    `
      SELECT
        r.id,
        r.tenant_id,
        r.first_name,
        r.last_name,
        r.gender,
        r.date_of_birth,
        r.admission_date,
        r.status,
        r.created_at,
        ra.medication_score,
        ra.nutrition_score,
        ra.vitals_score,
        ra.activity_score,
        ra.welfare_index,
        ra.updated_at AS analytics_updated_at
      FROM residents r
      LEFT JOIN resident_analytics ra
        ON ra.tenant_id = r.tenant_id
        AND ra.resident_id = r.id
      WHERE r.tenant_id = $1
        AND r.id = $2
    `,
    [tenantId, residentId],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    resident: toResident(row),
    analytics: toAnalytics(row),
  };
};

const listResidentNotifications = async ({ tenantId, residentId, limit, offset }) => {
  const result = await pool.query(
    `
      SELECT
        id,
        tenant_id,
        resident_id,
        type,
        title,
        message,
        status,
        created_at,
        updated_at
      FROM notifications
      WHERE tenant_id = $1
        AND resident_id = $2
      ORDER BY created_at DESC
      LIMIT $3
      OFFSET $4
    `,
    [tenantId, residentId, limit, offset],
  );

  return result.rows.map(toNotification);
};

module.exports = {
  getOverview,
  listResidentsWithAnalytics,
  listNotifications,
  findResidentDashboard,
  listResidentNotifications,
};
