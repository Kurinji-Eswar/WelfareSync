const { pool } = require('../auth/repository');

const initializeNotificationsTable = async () => {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'UNREAD',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT notifications_status_check CHECK (status IN ('UNREAD', 'READ')),
      CONSTRAINT notifications_type_check CHECK (type IN ('LOW_WELFARE_SCORE'))
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_tenant_id ON notifications(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_resident_id ON notifications(resident_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
    CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
    CREATE INDEX IF NOT EXISTS idx_notifications_tenant_resident ON notifications(tenant_id, resident_id);
  `);
};

const toNotification = (row) => {
  if (!row) return null;

  return {
    id: row.id,
    tenantId: row.tenant_id,
    residentId: row.resident_id,
    type: row.type,
    title: row.title,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const createNotification = async ({
  tenantId,
  residentId,
  type,
  title,
  message,
}) => {
  const result = await pool.query(
    `
      INSERT INTO notifications (
        tenant_id,
        resident_id,
        type,
        title,
        message
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        tenant_id,
        resident_id,
        type,
        title,
        message,
        status,
        created_at,
        updated_at
    `,
    [tenantId, residentId, type, title, message],
  );

  return toNotification(result.rows[0]);
};

const listNotifications = async ({ tenantId, status, limit, offset }) => {
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
        AND ($2::VARCHAR IS NULL OR status = $2)
      ORDER BY created_at DESC
      LIMIT $3
      OFFSET $4
    `,
    [tenantId, status || null, limit, offset],
  );

  return result.rows.map(toNotification);
};

const listResidentNotifications = async ({
  tenantId,
  residentId,
  status,
  limit,
  offset,
}) => {
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
        AND ($3::VARCHAR IS NULL OR status = $3)
      ORDER BY created_at DESC
      LIMIT $4
      OFFSET $5
    `,
    [tenantId, residentId, status || null, limit, offset],
  );

  return result.rows.map(toNotification);
};

const markNotificationAsRead = async ({ tenantId, notificationId }) => {
  const result = await pool.query(
    `
      UPDATE notifications
      SET
        status = 'READ',
        updated_at = NOW()
      WHERE tenant_id = $1
        AND id = $2
      RETURNING
        id,
        tenant_id,
        resident_id,
        type,
        title,
        message,
        status,
        created_at,
        updated_at
    `,
    [tenantId, notificationId],
  );

  return toNotification(result.rows[0]);
};

module.exports = {
  initializeNotificationsTable,
  createNotification,
  listNotifications,
  listResidentNotifications,
  markNotificationAsRead,
};
