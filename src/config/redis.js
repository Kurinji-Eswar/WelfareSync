const { createClient } = require('redis');
const { subscribeToCareLogCreated } = require('../events/subscribers/analyticsSubscriber');

let publisherClient;
let subscriberClient;
let isSubscriberRegistered = false;

const getRedisUrl = () => {
  if (!process.env.REDIS_URL) {
    throw new Error('REDIS_URL is required');
  }

  return process.env.REDIS_URL;
};

const createRedisClient = (name) => {
  const client = createClient({
    url: getRedisUrl(),
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
    },
  });

  client.on('error', (error) => {
    console.error(`Redis ${name} client error`, error);
  });

  client.on('connect', () => {
    console.info(`Redis ${name} client connected`);
  });

  client.on('end', () => {
    console.info(`Redis ${name} client disconnected`);
  });

  return client;
};

const connectRedis = async () => {
  if (!publisherClient) {
    publisherClient = createRedisClient('publisher');
  }

  if (!subscriberClient) {
    subscriberClient = createRedisClient('subscriber');
  }

  if (!publisherClient.isOpen) {
    await publisherClient.connect();
  }

  if (!subscriberClient.isOpen) {
    await subscriberClient.connect();
  }

  if (!isSubscriberRegistered) {
    await subscribeToCareLogCreated(subscriberClient);
    isSubscriberRegistered = true;
  }
};

const disconnectRedis = async () => {
  const clients = [subscriberClient, publisherClient].filter(Boolean);

  await Promise.all(clients.map(async (client) => {
    if (client.isOpen) {
      await client.quit();
    }
  }));

  isSubscriberRegistered = false;
};

const getRedisPublisher = () => {
  if (!publisherClient || !publisherClient.isOpen) {
    throw new Error('Redis publisher client is not connected');
  }

  return publisherClient;
};

module.exports = {
  connectRedis,
  disconnectRedis,
  getRedisPublisher,
};
