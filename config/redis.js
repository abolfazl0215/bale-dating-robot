const Redis = require("ioredis");
const Bull = require("bull");
const winston = require("winston");

// Logger configuration
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "queue-errors.log" }),
  ],
});

const REDIS_URL =
  global.currentPlatform == "bale"
    ? "redis://:UkBjGl7nfkbJCpW2@services.irn8.chabokan.net:53254"
    : "redis://default:VjQdb3pc5w7q5tMtV49proNfl4AjEIJO@redis-17678.crce309.us-east-1-6.ec2.cloud.redislabs.com:17678";

const redisClient = new Redis(REDIS_URL, {
  reconnectOnError: (err) => {
    logger.error("Redis reconnection error", err);
    return true;
  },
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const defaultQueueOptions = {
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: {
      count: 50,
    },
    removeOnFail: {
      count: 200,
    },
  },
  limiter: {
    max: 100, // Max jobs per duration
    duration: 1000, // Duration in milliseconds
  },
};
const defaultQueueOptionsForSendMessageToAll = {
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: {
      count: 50,
    },
    removeOnFail: {
      count: 200,
    },
  },
  limiter: {
    max: 20, // Max jobs per duration
    duration: 1000, // Duration in milliseconds
  },
};

const createQueue = (name) => {
  const defOptions =
    name == "sendMessageToAllQueue"
      ? defaultQueueOptionsForSendMessageToAll
      : defaultQueueOptions;

  const queue = new Bull(name, REDIS_URL, defOptions);

  queue.on("error", (error) => {
    logger.error(`Queue ${name} error:`, error);
  });

  queue.on("failed", (job, err) => {
    logger.warn(`Job in queue ${name} failed:`, {
      jobId: job.id,
      error: err,
    });
  });

  return queue;
};

const messageQueue = createQueue("messageQueue");
const globalOperationsQueue = createQueue("globalOperationsQueue");
const exploreQueue = createQueue("exploreQueue");
const activeUsersQueue = createQueue("activeUsersQueue");
const suggestQueue = createQueue("suggestQueue");
const newLikeQueue = createQueue("newLikeQueue");

const sendMessageToAllQueue = createQueue("sendMessageToAllQueue");
const cleanupOldUsersQueue = createQueue("cleanupOldUsersQueue");
const goToNotificationMenu = createQueue("goToNotificationMenu");
const requestToFillSuggestQueue = createQueue(
  "requestToFillSuggestQueue",
);
const fillForYouListQueue = createQueue("fillForYouListQueue");

module.exports = {
  redisClient,
  messageQueue,
  globalOperationsQueue,
  exploreQueue,
  activeUsersQueue,
  suggestQueue,
  newLikeQueue,
  sendMessageToAllQueue,
  cleanupOldUsersQueue,
  goToNotificationMenu,
  requestToFillSuggestQueue,
  fillForYouListQueue,
  logger,
};
