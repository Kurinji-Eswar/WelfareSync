require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const apiRoutes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const { connectPostgres, closePostgres } = require('./config/postgres');
const { connectMongo, disconnectMongo } = require('./config/mongodb');
const { initializeAuthTables } = require('./modules/auth/repository');
const { initializeInstitutionsTable } = require('./modules/institutions/repository');
const { initializeResidentsTable } = require('./modules/residents/repository');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const API_PREFIX = '/api/v1';

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
  credentials: process.env.CORS_CREDENTIALS === 'true',
}));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.URLENCODED_BODY_LIMIT || '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(API_PREFIX, apiRoutes);
app.use(errorHandler);

const initializeDatabase = async () => {
  await connectPostgres();
  await initializeAuthTables();
  await initializeInstitutionsTable();
  await initializeResidentsTable();

  try {
    await connectMongo();
  } catch (error) {
    console.error('MongoDB connection failed. Stopping application startup.', error);
    throw error;
  }
};

const closeDatabases = async () => {
  await Promise.allSettled([
    disconnectMongo(),
    closePostgres(),
  ]).then((results) => {
    const rejected = results.find((result) => result.status === 'rejected');

    if (rejected) {
      throw rejected.reason;
    }
  });
};

const startServer = async () => {
  await initializeDatabase();

  const server = app.listen(PORT, () => {
    console.log(`WelfareSync Engine listening on port ${PORT}`);
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received. Shutting down WelfareSync Engine.`);

    server.close(async () => {
      try {
        await closeDatabases();
        process.exit(0);
      } catch (error) {
        console.error('Failed to close database connections', error);
        process.exit(1);
      }
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

if (require.main === module) {
  startServer().catch(async (error) => {
    console.error('Failed to start WelfareSync Engine', error);
    try {
      await closeDatabases();
    } catch (shutdownError) {
      console.error('Failed to close database connections after startup failure', shutdownError);
    }
    process.exit(1);
  });
}

module.exports = {
  app,
  startServer,
  initializeDatabase,
};
