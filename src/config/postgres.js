const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  max: process.env.PGPOOL_MAX ? Number(process.env.PGPOOL_MAX) : 10,
  idleTimeoutMillis: process.env.PG_IDLE_TIMEOUT_MS
    ? Number(process.env.PG_IDLE_TIMEOUT_MS)
    : 30000,
  connectionTimeoutMillis: process.env.PG_CONNECTION_TIMEOUT_MS
    ? Number(process.env.PG_CONNECTION_TIMEOUT_MS)
    : 5000,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

const connectPostgres = async () => {
  const client = await pool.connect();

  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
};

const closePostgres = async () => {
  await pool.end();
};

module.exports = {
  pool,
  connectPostgres,
  closePostgres,
};
