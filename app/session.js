const {
  redisClient,
  cleanupOldUsersQueue,
} = require("../config/redis");
const state = require("./state");
const protobufModule = require("./protobuf");

let cachedTime = Date.now();
setInterval(() => {
  cachedTime = Date.now();
}, 5000);

function getNowTime() {
  return cachedTime;
}

async function loadBlockedUsers() {
  const ids = await redisClient.smembers("blocked_users");
  state.blockedUsers.clear();
  for (const id of ids) {
    state.blockedUsers.add(String(id));
  }
}

async function fillGlobalUsers() {
  const getDataGlobal = await redisClient.getBuffer(`globalUsers:female`);

  if (Buffer.isBuffer(getDataGlobal)) {
    await protobufModule.loadActiveUsersProto();
    const decodedMessage = protobufModule.ActiveUsersProto.decode(getDataGlobal);
    const usersArrayFromRedis = decodedMessage.users || [];
    state.setGlobalUsers(usersArrayFromRedis.slice(0, 50));
  }
}

function startGlobalUsersRefresh() {
  setTimeout(() => fillGlobalUsers(), 0);
  setInterval(() => fillGlobalUsers(), 30 * 60 * 1000);
}

async function cleanupOldUsersFromMapAndSaveToDB(time = 30) {
  const { usersMap, lastTimeAddProfileToList, forYouTime } = state;
  try {
    const now = Date.now();
    const thresholdMs = time * 60 * 1000;
    const entries = Array.from(usersMap.entries());

    await Promise.all(
      entries.map(async ([telegramId, userData]) => {
        if (now - userData.time < thresholdMs) return;
        try {
          cleanupOldUsersQueue.add({
            telegramId,
            currentUser: userData.user,
          });
          usersMap.delete(telegramId);
          lastTimeAddProfileToList.delete(telegramId);
          forYouTime.delete(telegramId);
        } catch (error) {
          console.log(error);
        }
      }),
    );

    console.log(
      `🧹 پاک‌سازی انجام شد. تعداد کاربران باقیمانده: ${usersMap.size}`,
    );
  } catch (error) {
    console.error("❌ خطا در پاک‌سازی کاربران:", error);
  }
}

async function startCleanupSchedule() {
  try {
    await cleanupOldUsersFromMapAndSaveToDB(30);
    setTimeout(startCleanupSchedule, 30 * 60 * 1000);
  } catch (error) {
    console.log(error);
  }
}

function scheduleCleanupStart() {
  setTimeout(() => startCleanupSchedule(), 10000);
}

module.exports = {
  getNowTime,
  loadBlockedUsers,
  fillGlobalUsers,
  startGlobalUsersRefresh,
  cleanupOldUsersFromMapAndSaveToDB,
  scheduleCleanupStart,
};
