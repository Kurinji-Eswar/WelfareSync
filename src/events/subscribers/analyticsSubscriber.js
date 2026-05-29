const { processCareLogEvent } = require('../../workers/analyticsWorker');

const CARE_LOG_CREATED_CHANNEL = 'care-log-created';

const subscribeToCareLogCreated = async (subscriberClient) => {
  await subscriberClient.subscribe(CARE_LOG_CREATED_CHANNEL, async (message) => {
    try {
      const event = JSON.parse(message);
      await processCareLogEvent(event);
    } catch (error) {
      console.error('Failed to process care-log-created event', error);
    }
  });

  console.info(`Subscribed to Redis channel: ${CARE_LOG_CREATED_CHANNEL}`);
};

module.exports = {
  subscribeToCareLogCreated,
};
