
// Local Bull worker for broadcast queue (same process as before)
require("./messageToAllQueue.js");

const bot = require("./utils/bot.js");
const { redisClient, sendMessageToAllQueue } = require("./config/redis");
const { createApp, startHttpServer } = require("./app/server");
const {
  startDailyReportPersistence,
  scheduleDailyReportBroadcast,
} = require("./app/dailyReport");
const {
  startMemoryLogging,
  startEventLoopMonitoring,
  startRedisPerformanceLogging,
} = require("./app/monitoring");
const {
  loadBlockedUsers,
  startGlobalUsersRefresh,
  scheduleCleanupStart,
} = require("./app/session");
const { registerLocalQueueWorkers } = require("./app/queueWorkers");
const { createProcessStatement } = require("./bot/processStatement");
const { registerBotHandlers } = require("./bot/registerHandlers");

const app = createApp();
startHttpServer(app);

startDailyReportPersistence();
scheduleDailyReportBroadcast(sendMessageToAllQueue);

startMemoryLogging();
startEventLoopMonitoring();
startRedisPerformanceLogging(redisClient);

registerLocalQueueWorkers();
loadBlockedUsers();

// Placeholder interval (notification cron was commented out in original)
setInterval(async () => {
  try {
    // await checkNewLikesForSendNotif(...)
  } catch (error) {
    console.log(error);
  }
}, 3600000);

startGlobalUsersRefresh();
scheduleCleanupStart();

const processStatement = createProcessStatement();
registerBotHandlers(bot, processStatement);

bot.launch();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
