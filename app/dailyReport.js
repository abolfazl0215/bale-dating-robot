const cron = require("node-cron");
const User = require("../models/User");
const DailyReport = require("../models/DailyReport");
const blockedUsers = require("../utils/blockedUsers");

function isSameDay(date1, date2) {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

let temporaryDailyReport = {
  time: new Date(),
  users: [],
  totalOfStatements: 0,
  totalOfLikes: 0,
  totalOfMatches: 0,
};
const currentActiveUsers = new Set();

async function loadDailyReport() {
  const lastReport = await DailyReport.findOne().sort({ time: -1 });
  const now = new Date();

  if (lastReport && isSameDay(lastReport?.time, now)) {
    temporaryDailyReport.users = lastReport.users;
    temporaryDailyReport.totalOfStatements = lastReport.totalOfStatements;
    temporaryDailyReport.totalOfLikes = lastReport.totalOfLikes;
    temporaryDailyReport.totalOfMatches = lastReport.totalOfMatches;
    if (Array.isArray(lastReport.users)) {
      lastReport.users.forEach((u) => currentActiveUsers.add(u));
    }
  } else {
    await DailyReport.create({
      time: now,
      users: [],
      totalOfStatements: 0,
      totalOfLikes: 0,
      totalOfMatches: 0,
    });
    temporaryDailyReport = {
      time: now,
      users: [],
      totalOfStatements: 0,
      totalOfLikes: 0,
      totalOfMatches: 0,
    };
  }
}

async function pushToDailyReport() {
  const lastReport = await DailyReport.findOne().sort({ time: -1 });
  const now = new Date();
  if (isSameDay(lastReport?.time, now)) {
    lastReport.users = temporaryDailyReport.users;
    lastReport.totalOfStatements = temporaryDailyReport.totalOfStatements;
    lastReport.totalOfLikes = temporaryDailyReport.totalOfLikes;
    lastReport.totalOfMatches = temporaryDailyReport.totalOfMatches;
    await lastReport.save();
  } else {
    await DailyReport.create({
      time: now,
      users: [],
      totalOfStatements: 0,
      totalOfLikes: 0,
      totalOfMatches: 0,
    });
    temporaryDailyReport = {
      time: now,
      users: [],
      totalOfStatements: 0,
      totalOfLikes: 0,
      totalOfMatches: 0,
    };
    currentActiveUsers.clear();
  }
}

function startDailyReportPersistence() {
  loadDailyReport();
  setInterval(async () => {
    try {
      await pushToDailyReport();
    } catch (error) {
      console.error("pushToDailyReport error:", error);
    }
  }, 30000);
}

function scheduleDailyReportBroadcast(sendMessageToAllQueue) {
  return cron.schedule(
    "0 23 * * *",
    async () => {
      try {
        const users = await User.find({}, { telegramId: 1 });
        const text = `😎 گزارش روزانه\n\nافراد فعال : ${temporaryDailyReport.users.length}\nتعداد کل دستورات : ${temporaryDailyReport.totalOfStatements}\nتعداد کل لایک ها : ${temporaryDailyReport.totalOfLikes > 50 ? temporaryDailyReport.totalOfLikes : "---"}\nتعداد کل مَچ ها : ${temporaryDailyReport.totalOfMatches > 5 ? temporaryDailyReport.totalOfMatches : "---"}`;
        await Promise.all(
          users.map((u) => {
            if (!blockedUsers.has(String(u.telegramId))) {
              sendMessageToAllQueue.add({
                telegramId: +u.telegramId,
                text,
              });
            }
          }),
        );
        console.log(`Success ✅ : ${users.length} jobs added to queue.`);
      } catch (err) {
        console.log(err);
      }
    },
    { scheduled: true, timezone: "Asia/Tehran" },
  );
}

function trackStatement(telegramId) {
  temporaryDailyReport.totalOfStatements += 1;
  if (!currentActiveUsers.has(telegramId)) {
    currentActiveUsers.add(telegramId);
    temporaryDailyReport.users.push(telegramId);
  }
}

module.exports = {
  temporaryDailyReport,
  currentActiveUsers,
  trackStatement,
  startDailyReportPersistence,
  scheduleDailyReportBroadcast,
};
