const mongoose = require('mongoose');

const getMongoUri = () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required');
  }

  return process.env.MONGO_URI;
};

const connectMongo = async () => {
  const mongoUri = getMongoUri();

  mongoose.connection.on('connected', () => {
    console.info('MongoDB connected');
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
  });

  mongoose.connection.on('error', (error) => {
    console.error('MongoDB connection error', error);
  });

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 5000),
    maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 10),
  });

  return mongoose.connection;
};

const disconnectMongo = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.info('MongoDB connection closed');
  }
};

module.exports = {
  connectMongo,
  disconnectMongo,
};
