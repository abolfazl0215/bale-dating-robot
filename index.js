const express = require("express");
const cors = require("cors");
const cron = require("node-cron");

const { registerInBot } = require("./components/registerInBot.js");
const editProfileInBot = require("./components/editProfileInBot.js");
const { changePhoto } = require("./components/changePhoto.js");

const http = require("http");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const User = require("./models/User");
const DailyReport = require("./models/DailyReport.js");
const protobuf = require("protobufjs");
const usersMap = require("./utils/usersMap");
const blockedUsers = require("./utils/blockedUsers.js");
const forYouList = require("./utils/forYouList");

require("dotenv").config();

const bot = require("./utils/bot.js");
const {
  redisClient,
  globalOperationsQueue,
  activeUsersQueue,
  newLikeQueue,
  sendMessageToAllQueue,
  cleanupOldUsersQueue,
  goToNotificationMenu,
  requestToFillSuggestQueue,
  fillForYouListQueue,
} = require("./config/redis");

const app = express();

const { default: axios } = require("axios");

const {
  generateInviteCode,
} = require("./utils/generateInviteCode.js");
const Report = require("./models/Report.js");
const Pictures = require("./models/Pictures.js");
const chunkArray = require("./utils/chunkArray.js");
// const cleanupOldUsersFromMapAndSaveToDB = require("./tools/CleanupOldUsersFromMapAndSaveToDB.js");
const editProfileMenu = require("./components/userSteps/editProfileMenu.js");
const searchStep = require("./components/userSteps/searchStep.js");
const adminRoutes = require("./routes/adminRoutes");
const fakeUsersRouter = require("./routes/fakeUersRouter");
const menuStep = require("./components/userSteps/menuStep.js");
const removeFromExplore = require("./components/removeFromExplore.js");
const { ErrorDetails$ } = require("@aws-sdk/client-s3");
const { messageToAllQueue } = require("./messageToAllQueue.js");
const { reply } = require("./telegram_methods/reply.js");
const { replyBot } = require("./telegram_methods/replyBot.js");
// const {
//   checkNewLikesForSendNotif,
// } = require("./tools/CheckNewLikesForSendNotif.js");
const lastViewed = require("./utils/lastViewed.js");
const { monitorEventLoopDelay } = require("perf_hooks");
// const { getPic } = require("./utils/getPic.js");

let globalUsers = [];

const server = http.createServer(app, {});

mongoose
  .connect(
    "mongodb://root:iufWbfg4Or7YpwwI@services.irn9.chabokan.net:10949",
    // "mongodb://root:EOYcwZU9ulmklCPQ0TaNIqKw@etna.liara.cloud:33903/my-app?authSource=admin",
  )
  .then(async () => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => console.error("Could not connect to MongoDB", err));

// Body parser configuration
app.use(bodyParser.json({ limit: "10mb" }));

// cors config
app.use(
  cors({
    origin: "*", // آدرس فرانت‌اند شما
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true, // ارسال کوکی‌ها به ازای درخواست‌های Cross-Origin
  }),
);
// app.options("*", cors()); // پاسخ به OPTIONS request
// app.options("*", cors()); // پاسخ به OPTIONS request

const PORT = 6338;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`server is running on port ${PORT}`);
});

// middleware for adding redisClient to req
app.use((req, res, next) => {
  req.redisClient = redisClient;
  next();
});
app.use(express.static("public"));

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

const loadDailyReport = async () => {
  const lastReport = await DailyReport.findOne().sort({ time: -1 });

  const now = new Date();

  if (lastReport && isSameDay(lastReport?.time, now)) {
    temporaryDailyReport.users = lastReport.users;
    temporaryDailyReport.totalOfStatements =
      lastReport.totalOfStatements;
    temporaryDailyReport.totalOfLikes = lastReport.totalOfLikes;
    temporaryDailyReport.totalOfMatches = lastReport.totalOfMatches;
    if (Array.isArray(lastReport.users)) {
      lastReport.users.forEach((u) => {
        currentActiveUsers.add(u);
      });
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
};
loadDailyReport();

const pushToDailyReport = async () => {
  const lastReport = await DailyReport.findOne().sort({ time: -1 });
  const now = new Date();
  if (isSameDay(lastReport?.time, now)) {
    lastReport.users = temporaryDailyReport.users;

    lastReport.totalOfStatements =
      temporaryDailyReport.totalOfStatements;
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
};
setInterval(async () => {
  try {
    await pushToDailyReport();
  } catch (error) {
    console.error("pushToDailyReport error:", error);
  }
}, 30000);

const scheduledTaskForSendDailyReportToUsers = cron.schedule(
  "0 23 * * *",
  async () => {
    try {
      const users = await User.find({}, { telegramId: 1 }); // فقط فیلد مورد نیاز را واکشی کنید

      // استفاده از Promise.all برای اضافه کردن سریع به صف
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

      console.log(
        `Success ✅ : ${users.length} jobs added to queue.`,
      );
    } catch (err) {
      console.log(err);
    }
  },
  {
    scheduled: true,
    timezone: "Asia/Tehran", // یا منطقه زمانی مورد نظر شما (مثلا Europe/London)
  },
);

// const tehranTime = new Date().toLocaleString("en-US", {
//   timeZone: "Asia/Tehran",
// });

// console.log({tehranTime});
// cron.schedule('40 20 * * *', async () => { // دقیقه 35، ساعت 22، هر روز
//   console.log('تست: اجرای وظیفه زمان‌بندی شده در ساعت 8:40 ----------------');
//   // کد اصلی که می‌خواهید اجرا شود را اینجا قرار دهید
// }, {
//   scheduled: true,
//   timezone: "Asia/Tehran"
// });

setInterval(() => {
  const mem = process.memoryUsage();
  console.log({
    rss: Math.round(mem.rss / 1024 / 1024) + " MB",
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + " MB",
    heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + " MB",
    external: Math.round(mem.external / 1024 / 1024) + " MB",
    uptime: Math.round(process.uptime()) + " sec",
  });
}, 30000);

const h = monitorEventLoopDelay({ resolution: 10 });
h.enable();

setInterval(() => {
  console.log({
    mean: Math.round(h.mean / 1e6) + " ms",
    max: Math.round(h.max / 1e6) + " ms",
    p99: Math.round(h.percentile(99) / 1e6) + " ms",
  });
  h.reset();
}, 30000);

async function logRedisPerformance() {
  // بررسی اتصال با ioredis کمی متفاوت است
  if (!redisClient || redisClient.status !== "ready") {
    console.log("Redis client not connected or ready.");
    return;
  }

  const operation = "PING";
  const keyToTest = "test_key_for_ping";
  const valueToSet = "ping_test_value";

  let startTime, endTime, duration, result;

  try {
    // --- تست PING ---
    startTime = Date.now();
    // متد PING در ioredis به همین شکل است
    result = await redisClient.ping();
    endTime = Date.now();
    duration = endTime - startTime;
    // برای ioredis، اطلاعات هاست و پورت را می‌توان از خود کلاینت گرفت
    console.log(
      `${new Date().toISOString()} | Redis ${operation} (to ${redisClient.options.host}:${redisClient.options.port}): ${duration}ms, Result: ${result}`,
    );

    // --- تست GET (اختیاری) ---

    startTime = Date.now();
    result = await redisClient.get(keyToTest);
    endTime = Date.now();
    duration = endTime - startTime;
    console.log(
      `${new Date().toISOString()} | Redis GET '${keyToTest}': ${duration}ms`,
    );

    // --- تست SET (اختیاری) ---

    startTime = Date.now();
    // برای ioredis، تنظیم expire به صورت آپشن جداگانه است
    result = await redisClient.set(keyToTest, valueToSet, "EX", 60); // EX for 60 seconds
    endTime = Date.now();
    duration = endTime - startTime;
    console.log(
      `${new Date().toISOString()} | Redis SET '${keyToTest}': ${duration}ms, Result: ${result}`,
    );
  } catch (error) {
    console.error(
      `${new Date().toISOString()} | Redis performance check failed:`,
      error.message,
    );
    // اگر خطایی رخ داد، ممکن است لازم باشد اتصال را دوباره چک کنید یا ریستارت کنید
    // redisClient.quit(); // یا disconnect()
  }
}

// اجرای تابع هر 30 ثانیه یک‌بار
const intervalId = setInterval(logRedisPerformance, 30000); // 30000 میلی‌ثانیه = 30 ثانیه

// Routes
app.use("/", adminRoutes);
app.use("/", fakeUsersRouter);

app.get("/", (req, res) => {
  res.send("hi");
});

// load new like protoBuffer <<<<<<<<<<<<<<<<<<
// load new like protoBuffer <<<<<<<<<<<<<<<<<<

let NewLikeProto;
let protoLoaded = false;

async function loadNewLikeProto() {
  if (protoLoaded && NewLikeProto) return;

  const userRoot = await protobuf.load(
    "./protoBuf_files/newLike.proto",
  );
  NewLikeProto = userRoot.lookupType("Users");
  protoLoaded = true;
}
loadNewLikeProto();
// load new like protoBuffer >>>>>>>>>>>>>>>>>>>
// load new like protoBuffer >>>>>>>>>>>>>>>>>>>

// load for you protoBuffer <<<<<<<<<<<<<<<<<<
// load for you protoBuffer <<<<<<<<<<<<<<<<<<
let ActiveUsersProto;
let activeUsersProtoLoaded = false;

async function loadActiveUsersProto() {
  if (activeUsersProtoLoaded && ActiveUsersProto) return;

  const userRoot = await protobuf.load(
    "./protoBuf_files/activeUsers.proto",
  );
  ActiveUsersProto = userRoot.lookupType("Users");
  activeUsersProtoLoaded = true;
}
loadActiveUsersProto();
// load for you protoBuffer >>>>>>>>>>>>>>>>>>>
// load for you protoBuffer >>>>>>>>>>>>>>>>>>>

// fillForYouListQueue.process(1, async (job) => {
//   const { telegramId, users } = job.data;
//   try {
//     forYouList.set(telegramId, users);
//   } catch (error) {
//     console.error("Error processing explore queue:", error);
//   }
// });

fillForYouListQueue.process(1, async (job) => {
  // 'jobName' را با نام واقعی وظیفه جایگزین کنید
  const { telegramId, users: newUsers } = job.data; // newUsers برای تمایز از users های دیگر

  try {
    const viewedUsersData = lastViewed.get(telegramId);
    const previouslyViewedUserIds = viewedUsersData?.usersList ?? [];
    const previouslyViewedSet = new Set();

    // console.log({ previouslyViewedUserIds });

    if (
      Array.isArray(previouslyViewedUserIds) &&
      previouslyViewedUserIds.length > 0
    ) {
      previouslyViewedUserIds.map((userId) => {
        // تغییر نام u به userId
        try {
          previouslyViewedSet.add(Number(userId)); // تبدیل به عدد برای اطمینان
        } catch (_) {
          // نادیده گرفتن خطاهای احتمالی در تبدیل
        }
      });

      const uniqueNewUsers = newUsers.filter(
        (user) => !previouslyViewedSet.has(Number(user.telegramId)),
      ); // تبدیل به عدد برای اطمینان
      forYouList.set(telegramId, uniqueNewUsers);
    } else {
      // اگر هیچ کاربری قبلاً مشاهده نشده بود، همه کاربران جدید را اضافه کن
      forYouList.set(telegramId, newUsers);
    }
  } catch (error) {
    console.error(
      `Error processing explore queue for telegramId ${telegramId}:`,
      error,
    ); // اضافه کردن telegramId به پیام خطا
  }
});

goToNotificationMenu.process(1, async (job) => {
  const { telegramId } = job.data;
  try {
    console.log("goToNotificationMenu : ", telegramId);
    const id = +telegramId; // تبدیل به عدد
    const userEntry = usersMap.get(id);
    if (userEntry) {
      const user = userEntry.user;
      user.userStep = "notificationMenu";
      usersMap.set(id, {
        user,
        time: Date.now(),
      });
    }
  } catch (error) {
    console.error("Error processing explore queue:", error);
  }
});

// load blocked users <<<<<<<<<<<<<<<<<<<<<<
// load blocked users <<<<<<<<<<<<<<<<<<<<<<

async function loadBlockedUsers() {
  const ids = await redisClient.smembers("blocked_users");
  blockedUsers.clear();
  for (const id of ids) {
    blockedUsers.add(String(id));
  }
}
loadBlockedUsers();
// load blocked users >>>>>>>>>>>>>>>>>>>>>>
// load blocked users >>>>>>>>>>>>>>>>>>>>>>

// current time <<<<<<<<<<<<<<<<<<<<<<
// current time <<<<<<<<<<<<<<<<<<<<<<
let cachedTime = Date.now();
setInterval(() => {
  cachedTime = Date.now();
}, 5000);
function getNowTime() {
  return cachedTime;
}
// current time >>>>>>>>>>>>>>>>>>>>>>
// current time >>>>>>>>>>>>>>>>>>>>>>

// check for new likes every 1 houre and send notification <<<
// check for new likes every 1 houre and send notification <<<
setInterval(async () => {
  try {
    // await checkNewLikesForSendNotif(
    //   redisClient,
    //   NewLikeProto,
    //   loadNewLikeProto,
    // );
  } catch (error) {
    console.log(error);
  }
  // }, 44000);
}, 3600000);
// check for new likes every 1 houre and send notification >>>
// check for new likes every 1 houre and send notification >>>

const ages = Array.from({ length: 63 }, (_, i) => 18 + i); // [18, 19, ..., 70]

const lastTimeAddProfileToList = new Map();
const forYouTime = new Map();

const cleanupOldUsersFromMapAndSaveToDB = async (time = 30) => {
  try {
    const now = Date.now();
    const thirtyMinutesInMs = time * 60 * 1000;

    const entries = Array.from(usersMap.entries());

    await Promise.all(
      entries.map(async ([telegramId, userData]) => {
        const timeDifference = now - userData.time;

        if (timeDifference >= thirtyMinutesInMs) {
          const currentUser = userData.user;

          try {
            cleanupOldUsersQueue.add({
              telegramId,
              currentUser,
            });

            usersMap.delete(telegramId);
            lastTimeAddProfileToList.delete(telegramId);
            forYouTime.delete(telegramId);
          } catch (error) {
            console.log(error);
          }
        }
      }),
    );

    console.log(
      `🧹 پاک‌سازی انجام شد. تعداد کاربران باقیمانده: ${usersMap.size}`,
    );
  } catch (error) {
    console.error("❌ خطا در پاک‌سازی کاربران:", error);
  }
};

// check and cleanup old users from map and save to mongoDB every 30 minutes <<<
// check and cleanup old users from map and save to mongoDB every 30 minutes <<<
async function startCleanup() {
  try {
    await cleanupOldUsersFromMapAndSaveToDB(30);
    setTimeout(startCleanup, 30 * 60 * 1000); // 30 دقیقه
  } catch (error) {
    console.log(error);
  }
}
setTimeout(() => {
  startCleanup();
}, 10000);

app.post("/cleanup", async (req, res) => {
  try {
    await cleanupOldUsersFromMapAndSaveToDB(0);
  } catch (error) {}
  res.send("finish ✅");
});
// check and cleanup old users from map and save to mingoDB every 30 minutes >>>
// check and cleanup old users from map and save to mingoDB every 30 minutes >>>

const fillGlobalUsers = async () => {
  const getDataGlobal = await redisClient.getBuffer(
    `globalUsers:female`,
  );

  if (Buffer.isBuffer(getDataGlobal)) {
    await loadActiveUsersProto();
    const decodedMessage = ActiveUsersProto.decode(getDataGlobal);
    const usersArrayFromRedis = decodedMessage.users || [];
    const subArray = usersArrayFromRedis.slice(0, 50);

    globalUsers = subArray;
  }
};
setTimeout(async () => {
  await fillGlobalUsers();
}, 0);
setInterval(
  async () => {
    await fillGlobalUsers();
  },
  30 * 60 * 1000,
);

// generate invite link <<<<<<<<<<<<<<<<<<<<
const generateInviteLink = (telegramId) => {
  return `https://ble.ir/pounesbot?start=${generateInviteCode(
    telegramId,
  )}`;
};
// generate invite link >>>>>>>>>>>>>>>>>>>>

const processStatement = async (ctx, next) => {
  try {
    const telegramId = ctx?.from?.id;
    const telegramName = ctx?.from?.first_name;
    const userName = ctx?.from?.username;
    const isBot = ctx?.from?.is_bot;
    const inviteCode = ctx?.startPayload;

    temporaryDailyReport.totalOfStatements += 1;
    if (!currentActiveUsers.has(telegramId)) {
      currentActiveUsers.add(telegramId);
      temporaryDailyReport.users.push(telegramId);
    }

    if (ctx.message.successful_payment) {
      try {
        console.log("پرداخت موفق:", ctx.message.successful_payment);
        await ctx.reply(
          "✅ پرداخت موفق ! اشتراک شما فعال شد. \n\nمشاهده مچ ها (افرادی که با آنها مطابقت داده شده اید) \n/matches\n/matches\n/matches",
        );
        setTimeout(async () => {
          let existingUser;
          if (usersMap.get(telegramId)) {
            existingUser = usersMap.get(telegramId).user;
            usersMap.get(telegramId).time = getNowTime();
          } else {
            try {
              existingUser = await User.findOne({ telegramId });
              if (existingUser) {
                usersMap.set(telegramId, {
                  user: existingUser,
                  time: getNowTime(),
                });
              }
            } catch (error) {
              console.log(error);
            }
          }
          if (!existingUser) return;
          existingUser.userStep = "menu";
          usersMap.set(telegramId, {
            user: existingUser,
            time: Date.now(),
          });
          try {
            await reply(
              ctx,
              next,
              redisClient,
              `1. ${"مشاهده پروفایل ها"}\n2. ${"پروفایل من"}\n3. ${"حالت خواب"}\n----------------------------\n4. ${"دوستان خود را دعوت کنید تا لایک های بیشتری دریافت کنید 😎"}`,
              [
                [
                  { text: "1 🚀" },
                  { text: "2" },
                  { text: "3" },
                  { text: "4" },
                ],
              ],
            );
          } catch (error) {
            console.log(error);
          }
        }, 200);
      } catch (error) {
        console.log(error);
      }
      return;
    }

    // load new like protoBuffer  <<<<<<<<<<<<<<<<<<<<<
    // load new like protoBuffer  <<<<<<<<<<<<<<<<<<<<<
    try {
      await loadNewLikeProto();
    } catch (error) {
      console.log(error);
    }
    // load new like protoBuffer  >>>>>>>>>>>>>>>>>>>>
    // load new like protoBuffer  >>>>>>>>>>>>>>>>>>>>

    // load for you protoBuffer  <<<<<<<<<<<<<<<<<<<<<
    // load for you protoBuffer  <<<<<<<<<<<<<<<<<<<<<
    try {
      await loadActiveUsersProto();
    } catch (error) {
      console.log(error);
    }
    // load for you protoBuffer  >>>>>>>>>>>>>>>>>>>>
    // load for you protoBuffer  >>>>>>>>>>>>>>>>>>>>

    if (isBot || !telegramId) {
      console.log(
        "no telegram id | bot",
        { isBot },
        ctx?.message?.text,
      );
      return next();
    }

    // check blocked users <<<<<<<<<<<<<<<<<<<<<<<<<<<<<
    // check blocked users <<<<<<<<<<<<<<<<<<<<<<<<<<<<<
    if (blockedUsers.has(String(telegramId))) {
      try {
        await ctx.telegram.getChat(telegramId);
        await redisClient.srem("blocked_users", String(telegramId));
        blockedUsers.delete(String(telegramId));
        console.log("unblocked user ------------");
      } catch (error) {
        console.log("find a block ............ ", ctx?.message?.text);
        return next();
      }
    }
    // check blocked users >>>>>>>>>>>>>>>>>>>>>>>>>
    // check blocked users >>>>>>>>>>>>>>>>>>>>>>>>>

    // set existingUser <<<<<<<<<<<<<<<<<<<<<<<<<<<<<
    // set existingUser <<<<<<<<<<<<<<<<<<<<<<<<<<<<<
    let existingUser;
    if (usersMap.get(telegramId)) {
      existingUser = usersMap.get(telegramId).user;
      usersMap.get(telegramId).time = getNowTime();
    } else {
      try {
        existingUser = await User.findOne({ telegramId });
        if (existingUser) {
          usersMap.set(telegramId, {
            user: existingUser,
            time: getNowTime(),
          });
        }
      } catch (error) {
        console.log(error);
      }
    }
    // console.log("look for : ", existingUser.lookingFor);
    // set existingUser >>>>>>>>>>>>>>>>>>>>>>>>>>>>>
    // set existingUser >>>>>>>>>>>>>>>>>>>>>>>>>>>>>

    // check if user is banned cant use bot <<<<<<<<<
    // check if user is banned cant use bot <<<<<<<<<
    if (existingUser?.ban) {
      try {
        await reply(ctx, next, redisClient, "شما مسدود شده اید");
      } catch (error) {
        console.log(error);
      }
      return;
    }
    // check if user is banned cant use bot >>>>>>>>>
    // check if user is banned cant use bot >>>>>>>>>

    // if user changed userName update it in database <<<<<<<<<<<
    // if user changed userName update it in database <<<<<<<<<<<
    if (existingUser && userName !== existingUser?.userName) {
      const updatedUser = await User.findOneAndUpdate(
        { telegramId },
        { userName: userName || "" },
        { returnDocument: "after" },
      );
      usersMap.set(telegramId, {
        user: updatedUser,
        time: getNowTime(),
      });
      existingUser = updatedUser;
    }
    // if user changed userName update it in database >>>>>>>>>>>
    // if user changed userName update it in database >>>>>>>>>>>


    // check if user exist in database and after 8 minutes and 20 seconds add profile to forYou queue again <<<
    // check if user exist in database and after 8 minutes and 20 seconds add profile to forYou queue again <<<
    // check if user exist in database and after 8 minutes and 20 seconds add profile to forYou queue again <<<
    if (existingUser) {
      // after 8 minutes and 20 seconds add profile to forYou queue again and update last time <<<
      const lastTime = lastTimeAddProfileToList.get(telegramId);
      if (lastTime) {
        const userStep = existingUser?.userStep || "register";
        if (userStep !== "register") {
          if (lastTime + 500000 < Date.now()) {
            lastTimeAddProfileToList.set(telegramId, Date.now());
            activeUsersQueue.add({ telegramId });
          }
        }
        // after 8 minutes and 20 seconds add profile to forYou queue again and update last time >>>
      } else {
        // add profile to foryou and update last time <<<
        const userStep = existingUser?.userStep || "register";
        if (userStep !== "register") {
          activeUsersQueue.add({ telegramId });
          lastTimeAddProfileToList.set(telegramId, Date.now());
        }
        // add profile to foryou and update last time >>>
      }
    }
    // check if user exist in database and after 8 minutes and 20 seconds add profile to forYou queue again >>>
    // check if user exist in database and after 8 minutes and 20 seconds add profile to forYou queue again >>>
    // check if user exist in database and after 8 minutes and 20 seconds add profile to forYou queue again >>>
    // ctx.reply("----در حال بروزرسانی----")

    if (existingUser) {
      const userStep = existingUser.userStep;

      // Check if forYou list needs to be refilled and refill if necessary and add to suggestQueue <<<
      // forYou list = suggestions users to show to user
      const currentList = forYouList.get(telegramId);
      const needsRefill =
        !currentList ||
        !Array.isArray(currentList) ||
        currentList.length <= 3;
      if (needsRefill && userStep !== "register") {
        // const lookFor =
        //   existingUser.gender === "male" ? "female" : "male";
        // const getDataGlobal = await redisClient.getBuffer(
        //   `globalUsers:${lookFor.toLowerCase()}`,
        // );

        // if (Buffer.isBuffer(getDataGlobal)) {
        //   await loadActiveUsersProto();
        //   const decodedMessage =
        //     ActiveUsersProto.decode(getDataGlobal);
        //   const usersArrayFromRedis = decodedMessage.users || [];
        //   const subArray = usersArrayFromRedis.slice(0, 10);

        forYouList.set(telegramId, [...globalUsers]);
        // }

        forYouTime.set(telegramId, Date.now());

        // Add to search queue
        requestToFillSuggestQueue.add({
          telegramId,
          user: existingUser,
        });
      }

      // Check if forYou list needs to be refilled and refill if necessary and add to suggestQueue >>>
      if (userStep === "register") {
        await registerInBot(
          ctx,
          next,
          ages,
          chunkArray,
          telegramId,
          telegramName,
          existingUser,
          redisClient,
          forYouList,
          forYouTime,
          activeUsersQueue,
          ActiveUsersProto,
        );
      } else if (userStep === "editProfileMenu") {
        await editProfileMenu(
          ctx,
          next,
          redisClient,
          telegramId,
          existingUser,
          usersMap,
          forYouList,
          forYouTime,
          ages,
        );
      } else if (userStep === "editProfile") {
        editProfileInBot(
          ctx,
          next,
          chunkArray,
          ages,
          telegramId,
          existingUser,
          redisClient,
          forYouList,
          forYouTime,
          activeUsersQueue,
          telegramName,
          ActiveUsersProto,
        );
      } else if (userStep === "changePhoto") {
        // if (
        //   !existingUser?.limitGetPicture ||
        //   !existingUser?.limitGetPicture?.time
        // )
        //   existingUser.limitGetPicture = {
        //     time: Date.now(),
        //     count: 0,
        //   };

        // const lastTimeSetPic = existingUser?.limitGetPicture?.time;
        //  if (
        //   lastTimeSetPic + 180000 < Date.now()
        // )
        //   existingUser.limitGetPicture = {
        //     time: Date.now(),
        //     count: 0,
        //   };

        // if (
        //   lastTimeSetPic + 180000 > Date.now() &&
        //   existingUser?.limitGetPicture?.count >= 3
        // ) {
        //    existingUser.userStep = "editProfileMenu";

        //         usersMap.set(telegramId, {
        //           time: Date.now(),
        //           user: existingUser,
        //         });

        //         await reply(
        //           ctx,
        //           next,
        //           redisClient,
        //           `1. ${"مشاهده پروفایل ها"} \n2. ${"ویرایش پروفایلم"} \n3. ${"تغییر عکس من"}`,
        //           [[{ text: "1🚀" }, { text: "2" }, { text: "3" }]],
        //         );
        //  await reply(
        //           ctx,
        //           next,
        //           redisClient,
        //           `⭕ در هر روز فقط 3 بار میتوانید تصویر پروفایل را تغییر دهید`,

        //         );
        //         return;
        // }

        await changePhoto(
          ctx,
          next,
          telegramId,
          existingUser,
          redisClient,
          forYouList,
          forYouTime,
        );
      } else if (userStep === "search") {
        if (
          ctx?.message?.text === "❤️" ||
          // ctx?.message?.text === "❌" ||
          ctx?.message?.text === "💌"
        ) {
          const likeCountCalculateByGender =
            existingUser.gender == "male" ? 30 : 50;
          if (
            existingUser.firstLikeTime + 86400000 > Date.now() &&
            existingUser.likeCount > likeCountCalculateByGender
          ) {
            if (existingUser.giftLikeCount > 0) {
              existingUser.giftLikeCount -= 1;
              usersMap.set(telegramId, {
                time: Date.now(),
                user: existingUser,
              });
            } else {
              const remindTime =
                existingUser.firstLikeTime + 86400000 - Date.now();

              // اطمینان از اینکه مقدار منفی نباشد
              const totalMilliseconds = Math.max(0, remindTime);

              // تبدیل به ساعت و دقیقه
              const hours = Math.floor(
                totalMilliseconds / (1000 * 60 * 60),
              );
              const minutes = Math.floor(
                (totalMilliseconds % (1000 * 60 * 60)) / (1000 * 60),
              );

              // ساخت خروجی فارسی
              const result = `${hours} ساعت و ${minutes} دقیقه`;

              try {
                await reply(
                  ctx,
                  next,
                  redisClient,
                  `⚠️  شما فقط تعداد ${likeCountCalculateByGender} لایک در روز می‌توانید داشته باشید. برای لایک بیشتر میتوانید لایک خریداری کنید یا دوستان خود را دعوت کنید و 50 لایک هدیه بگیرید . بنر دعوت شما 👇🏽.\n\n🕜 ${result} دیگر لایک روزانه دریافت میکنید .`,
                  [],
                  [
                    [
                      {
                        text: "خرید لایک ❤️",
                        callback_data: "buy_like",
                      },
                    ],
                  ],
                );
                const inviteLink = `https://ble.ir/pounesbot?start=${generateInviteCode(
                  +telegramId,
                )}`;
                const shareText =
                  "ربات دوستیابی پونس 🔥 در بله است! یک دوست جدید یا حتی یک عاشق پیدا کنید 👫" +
                  "\n👉🏻 " +
                  inviteLink;

                // await ctx.reply(shareText);
                await reply(ctx, next, redisClient, shareText);
              } catch (error) {
                console.log(error);
              }

              return;
            }
          } else if (
            existingUser.firstLikeTime + 86400000 <
            Date.now()
          ) {
            existingUser.firstLikeTime = Date.now();
            existingUser.likeCount = 1;
            usersMap.set(telegramId, {
              time: Date.now(),
              user: existingUser,
            });
          } else {
            existingUser.firstLikeTime = Date.now();
            existingUser.likeCount =
              (existingUser.likeCount || 0) + 1;
            usersMap.set(telegramId, {
              time: Date.now(),
              user: existingUser,
            });
          }
        }

        if (
          ctx?.message?.text === "❤️" ||
          ctx?.message?.text === "❌" ||
          ctx?.message?.text === "💌"
        ) {
          try {
            const item = forYouList.get(telegramId)?.[0]?.telegramId;
            if (!item) return; // جلوگیری از خطا اگر آیتم وجود ندارد

            const current =
              lastViewed.get(telegramId)?.usersList ?? [];

            lastViewed.set(telegramId, {
              usersList: [...current, Number(item)],
            });
          } catch (error) {
            console.log(error);
          }
        }

        if (
          ctx?.message?.text === "❤️" ||
          ctx?.message?.text === "💌"
        ) {
          // if user is not have username ask to fill it <<<<<<<<<<<<<<
          // if user is not have username ask to fill it <<<<<<<<<<<<<<
          if (!userName) {
            try {
              try {
                await ctx.replyWithPhoto(
                  "https://nodejs-x695j4.chbk.dev/uploads/username.jpg",
                  {
                    caption:
                      "برای استفاده از ربات حتما باید یک شناسه کاربری (آیدی) در بله داشته باشید ، یک نام کاربری برای خود انتخاب کنید و سپس مجددا امتحان کنید \n حساب کاربری --> شناسه کاربری",
                    reply_markup: {
                      inline_keyboard: [
                        [
                          {
                            text: "انجام دادم ✅",
                            callback_data: "done_start",
                          },
                        ],
                      ],
                    },
                  },
                );
              } catch (error) {
                try {
                  await reply(
                    ctx,
                    next,
                    redisClient,
                    "برای استفاده از ربات حتما باید یک شناسه کاربری (آیدی) در بله داشته باشید ، یک نام کاربری برای خود انتخاب کنید و سپس مجددا امتحان کنید \n حساب کاربری --> شناسه کاربری",
                    [],
                    [
                      [
                        {
                          text: "انجام دادم ✅",
                          callback_data: "done_start",
                        },
                      ],
                    ],
                  );
                } catch (error) {
                  console.log(error);
                }
              }
            } catch (e) {
              try {
                await reply(
                  ctx,
                  next,
                  redisClient,
                  "برای استفاده از ربات حتما باید یک شناسه کاربری (آیدی) در بله داشته باشید ، یک نام کاربری برای خود انتخاب کنید و سپس مجددا امتحان کنید \n حساب کاربری --> شناسه کاربری",
                );
              } catch (error) {
                console.log(error);
              }
            }
            return;
          }
          // if user is not have username ask to fill it >>>>>>>>>>>>>>
          // if user is not have username ask to fill it >>>>>>>>>>>>>>
        }

        // Handle forYouList queue management
        if (
          forYouList.get(telegramId) &&
          Array.isArray(forYouList.get(telegramId)) &&
          forYouList.get(telegramId).length > 10 &&
          forYouTime.get(telegramId) &&
          forYouTime.get(telegramId) + 600000 > Date.now()
        ) {
          // List is still valid, no need to add to queue
        } else {
          forYouTime.set(telegramId, Date.now());
          // add to search queue
          requestToFillSuggestQueue.add({
            telegramId,
            user: existingUser,
          });
        }

        if (ctx?.message?.text === "☰") {
          try {
            existingUser.userStep = "menu";

            // Update user in database
            await User.findOneAndUpdate(
              { telegramId },
              { userStep: "menu" },
            );

            // Update user in map
            usersMap.set(telegramId, {
              time: Date.now(),
              user: existingUser,
            });
            await reply(
              ctx,
              next,
              redisClient,
              `1. ${"مشاهده پروفایل ها"}\n2. ${"پروفایل من"}\n3. ${"حالت خواب"}\n----------------------------\n4. ${"دوستان خود را دعوت کنید تا لایک های بیشتری دریافت کنید 😎"}`,
              [
                [
                  { text: "1 🚀" },
                  { text: "2" },
                  { text: "3" },
                  { text: "4" },
                ],
              ],
            );
          } catch (error) {
            console.log(error);
          }
        } else if (ctx?.message?.text === "❤️") {
          temporaryDailyReport.totalOfLikes += 1;
          if (
            forYouList.get(telegramId) &&
            forYouList.get(telegramId)[0]
          ) {
            // newLike for notification
            newLikeQueue.add({
              telegramId: +forYouList.get(telegramId)[0]?.telegramId,
              liker: existingUser,
            });
          } else {
            console.log("liker id notfoundddd -------------");
          }

          if (!existingUser.firstLike) {
            try {
              await reply(
                ctx,
                next,
                redisClient,
                "❤️ : لایک\n❌ : رد کردن\n💌 : لایک به همراه پیام\n☰ : منو\n\nوقتی کاربری را لایک میکنید ، لایک شما برای او ارسال میشود و اگر اوهم شما را لایک کند ، متصل میشوید .",
              );
              existingUser.firstLike = 1;
              usersMap.set(telegramId, {
                time: Date.now(),
                user: existingUser,
              });
            } catch (error) {
              console.log(error);
            }
          }

          const targetId = forYouList.get(telegramId)?.[0]?.telegramId
            ? +forYouList.get(telegramId)?.[0]?.telegramId
            : 0;
          const fullItem = forYouList.get(telegramId)?.[0];

          // console.log("--> ", forYouList.get(telegramId)?.[0]);

          globalOperationsQueue.add({
            type: "like",
            data: {
              telegramId,
              targetId: +targetId,
              fullItem,
            },
          });

          const list = forYouList.get(telegramId);
          if (Array.isArray(list)) {
            list.shift(); // فقط آیتم اول حذف می‌شود
            forYouList.set(telegramId, list); // دوباره در map قرار می‌دهیم (اختیاری)
          }

          const nextUser = forYouList.get(telegramId)?.[0];
          if (!nextUser) {
            await reply(
              ctx,
              next,
              redisClient,
              "کاربری برای نمایش وجود ندارد",
            );
            return;
          }

          const {
            fullName,
            age,
            state,
            bio,
            profileImages,
            inviteCode: inviteCode_from_forYouList,
          } = nextUser;
          userTelId = forYouList.get(telegramId)[0].telegramId;

          const photos = profileImages;

          try {
            // const buffer = await getPic(photos[0]);
            await ctx.replyWithPhoto(
              photos[0],
              // {
              //   source:
              //     fs.existsSync(photos[0]) &&
              //     fs.createReadStream(photos[0]),
              // },
              {
                caption: `${fullName}, ${age}, ${state} ${
                  bio ? "\n" + bio : ""
                } \n/user_${inviteCode_from_forYouList || "not_found"}`,
              },
            );
          } catch (error) {
            try {
              // await ctx.reply(
              //   `${fullName}, ${age}, ${state} ${
              //     bio ? "\n" + bio : ""
              //   } \n/user_${inviteCode_from_forYouList || "not_found"}`,
              // );
              await reply(
                ctx,
                next,
                redisClient,
                `${fullName}, ${age}, ${state} ${
                  bio ? "\n" + bio : ""
                } \n/user_${inviteCode_from_forYouList || "not_found"}`,
              );
            } catch (error) {
              console.log(error);
            }
          }

          existingUser.lastViewed =
            +forYouList.get(telegramId)[0].telegramId; // نیاز به ذخیره کردنش نیست
          usersMap.set(telegramId, {
            time: Date.now(),
            user: existingUser,
          });
        } else if (ctx?.message?.text === "❌") {
          const targetId =
            forYouList.get(telegramId)?.[0]?.telegramId;

          if (!existingUser.firstNope) {
            try {
              // await ctx.reply(
              //   "❤️ : لایک\n❌ : (رد کردن)نوپ\n💌 : لایک به همراه پیام\n☰ : منو\n\nوقتی کاربری را لایک میکنید ، لایک شما برای او ارسال میشود و اگر اوهم شما را لایک کند ، متصل میشوید .",
              // );
              await reply(
                ctx,
                next,
                redisClient,
                "❤️ : لایک\n❌ : رد کردن\n💌 : لایک به همراه پیام\n☰ : منو\n\nوقتی کاربری را لایک میکنید ، لایک شما برای او ارسال میشود و اگر اوهم شما را لایک کند ، متصل میشوید .",
              );
            } catch (error) {
              console.log(error);
            }

            existingUser.firstNope = 1;
            usersMap.set(telegramId, {
              time: Date.now(),
              user: existingUser,
            });
          }

          globalOperationsQueue.add({
            type: "nope",
            data: {
              telegramId,
              targetId: +targetId,
            },
          });

          const list = forYouList.get(telegramId);
          if (Array.isArray(list)) {
            list.shift(); // فقط آیتم اول حذف می‌شود
            forYouList.set(telegramId, list); // دوباره در map قرار می‌دهیم (اختیاری)
          }

          const nextUser = forYouList.get(telegramId)?.[0];
          if (!nextUser) {
            await reply(
              ctx,
              next,
              redisClient,
              "کاربری برای نمایش وجود ندارد",
            );
            return;
          }

          const {
            fullName,
            age,
            state,
            bio,
            profileImages,
            inviteCode: inviteCode_from_forYouList,
          } = nextUser;
          userTelId = forYouList.get(telegramId)[0].telegramId;

          const photos = profileImages;

          try {
            // const buffer = await getPic(photos[0]);
            await ctx.replyWithPhoto(
              photos[0],
              // {
              //   source:
              //     fs.existsSync(photos[0]) &&
              //     fs.createReadStream(photos[0]),
              // },
              {
                caption: `${fullName}, ${age}, ${state} ${
                  bio ? "\n" + bio : ""
                } \n/user_${inviteCode_from_forYouList || "not_found"}`,
              },
            );
          } catch (error) {
            try {
              // await ctx.reply(
              //   `${fullName}, ${age}, ${state} ${
              //     bio ? "\n" + bio : ""
              //   } \n/user_${inviteCode_from_forYouList || "not_found"}`,
              // );
              await reply(
                ctx,
                next,
                redisClient,
                `${fullName}, ${age}, ${state} ${
                  bio ? "\n" + bio : ""
                } \n/user_${inviteCode_from_forYouList || "not_found"}`,
              );
            } catch (error) {
              console.log(error);
            }
          }

          existingUser.lastViewed =
            +forYouList.get(telegramId)[0].telegramId; // نیاز به ذخیره کردنش نیست
          usersMap.set(telegramId, {
            time: Date.now(),
            user: existingUser,
          });
        } else if (ctx?.message?.text === "💌") {
          existingUser.userStep = "likeWithMessage";
          usersMap.set(telegramId, {
            time: Date.now(),
            user: existingUser,
          });
          try {
            await reply(
              ctx,
              next,
              redisClient,
              "پیام خود را ارسال کنید 💌👇🏻 \n\n -- لایک شما به همراه این پیام برای کاربر ارسال میشود  ",
              [[{ text: "بازگشت" }]],
            );
          } catch (error) {
            console.log(error);
          }
        } else {
          try {
            await reply(ctx, next, redisClient, "🧐👇🏽", [
              [
                { text: "☰" },
                { text: "❤️" },
                { text: "❌" },
                { text: "💌" },
              ],
            ]);
          } catch (error) {
            console.log(error);
          }
        }
      } else if (userStep === "menu") {
        await menuStep(
          ctx,
          next,
          existingUser,
          usersMap,
          forYouList,
          forYouTime,
          telegramId,
          generateInviteLink,
          redisClient,
        );
      } else if (userStep === "invite") {
        if (ctx?.message?.text === "بازگشت") {
          existingUser.userStep = "menu";
          usersMap.set(telegramId, {
            time: Date.now(),
            user: existingUser,
          });
          try {
            await reply(
              ctx,
              next,
              redisClient,
              `1. ${"مشاهده پروفایل ها"}\n2. ${"پروفایل من"}\n3. ${"حالت خواب"}\n----------------------------\n4. ${"دوستان خود را دعوت کنید تا لایک های بیشتری دریافت کنید 😎"}`,
              [
                [
                  { text: "1 🚀" },
                  { text: "2" },
                  { text: "3" },
                  { text: "4" },
                  //{ text: "5" },
                ],
              ],
            );
          } catch (error) {
            console.log(error);
          }
        } else {
          try {
            // await ctx.reply(
            //   "دوستان خود را دعوت کنید تا لایک های بیشتری دریافت کنید!\n\nبا دوستان خود یا در شبکه های اجتماعی خود به اشتراک گذاری کنید!\nلینک شخصی شما 👇🏽",
            //   {
            //     reply_markup: {
            //       keyboard: [[{ text: "بازگشت" }]],
            //       resize_keyboard: true,
            //       one_time_keyboard: false,
            //       is_persistent: true,
            //     },
            //   },
            // );
            await reply(
              ctx,
              next,
              redisClient,
              "دوستان خود را دعوت کنید تا لایک های بیشتری دریافت کنید!\n\nبا دوستان خود یا در شبکه های اجتماعی خود به اشتراک گذاری کنید!\nلینک شخصی شما 👇🏽",
              [[{ text: "بازگشت" }]],
            );
            const shareText =
              "ربات دوستیابی پونس 🔥 در بله است! یک دوست جدید یا حتی یک عاشق پیدا کنید 👫" +
              "\n👉🏻 " +
              generateInviteLink(telegramId);

            // await ctx.reply(shareText);
            await reply(ctx, next, redisClient, shareText);
          } catch (error) {
            console.log(error);
          }
        }
      } else if (userStep === "sleep") {
        if (ctx?.message?.text === "بازگشت") {
          try {
            existingUser.userStep = "menu";
            // await existingUser.save();
            usersMap.set(telegramId, {
              time: Date.now(),
              user: existingUser,
            });

            try {
              // await ctx.reply(
              //   `1. ${"مشاهده پروفایل ها"}\n2. ${"پروفایل من"}\n3. ${"حالت خواب"}\n----------------------------\n4. ${"دوستان خود را دعوت کنید تا لایک های بیشتری دریافت کنید 😎"}`,
              //   {
              //     reply_markup: {
              //       keyboard: [
              //         [
              //           { text: "1 🚀" },
              //           { text: "2" },
              //           { text: "3" },
              //           { text: "4" },
              //           //{ text: "5" },
              //         ],
              //       ],
              //       resize_keyboard: true,
              //       is_persistent: true,
              //     },
              //   },
              // );
              await reply(
                ctx,
                next,
                redisClient,
                `1. ${"مشاهده پروفایل ها"}\n2. ${"پروفایل من"}\n3. ${"حالت خواب"}\n----------------------------\n4. ${"دوستان خود را دعوت کنید تا لایک های بیشتری دریافت کنید 😎"}`,
                [
                  [
                    { text: "1 🚀" },
                    { text: "2" },
                    { text: "3" },
                    { text: "4" },
                    //{ text: "5" },
                  ],
                ],
              );
            } catch (error) {
              console.log(error);
            }
          } catch (error) {
            console.log({ error });
          }
        } else if (
          ctx?.message?.text === "فعال" ||
          ctx?.message?.text === "غیرفعال"
        ) {
          try {
            existingUser.userStep = "menu";
            const sleppStatus = !existingUser.sleep;
            existingUser.sleep = sleppStatus;
            // save in redis
            await redisClient.hmset(`user:${telegramId}`, {
              sleep: sleppStatus,
            });
            usersMap.set(telegramId, {
              time: Date.now(),
              user: existingUser,
            });
            // await existingUser.save();

            // await ctx.reply("✅");
            await reply(ctx, next, redisClient, "✅");
            // await ctx.reply(
            //   `1. ${"مشاهده پروفایل ها"}\n2. ${"پروفایل من"}\n3. ${"حالت خواب"}\n----------------------------\n4. ${"دوستان خود را دعوت کنید تا لایک های بیشتری دریافت کنید 😎"}`,
            //   {
            //     reply_markup: {
            //       keyboard: [
            //         [
            //           { text: "1 🚀" },
            //           { text: "2" },
            //           { text: "3" },
            //           { text: "4" },
            //           //{ text: "5" },
            //         ],
            //       ],
            //       resize_keyboard: true,
            //       is_persistent: true,
            //     },
            //   },
            // );
            await reply(
              ctx,
              next,
              redisClient,
              `1. ${"مشاهده پروفایل ها"}\n2. ${"پروفایل من"}\n3. ${"حالت خواب"}\n----------------------------\n4. ${"دوستان خود را دعوت کنید تا لایک های بیشتری دریافت کنید 😎"}`,
              [
                [
                  { text: "1 🚀" },
                  { text: "2" },
                  { text: "3" },
                  { text: "4" },
                  //{ text: "5" },
                ],
              ],
            );
          } catch (error) {
            console.log({ error });
          }
        } else {
          try {
            // await ctx.reply(
            //   `${"حالت خواب"}: ${
            //     existingUser.sleep ? "فعال" : "غیرفعال"
            //   }\n\n${"اگر حالت خواب فعال باشد ، لایکی دریافت نمیکنید"}`,
            //   {
            //     reply_markup: {
            //       keyboard: [
            //         [
            //           {
            //             text: existingUser.sleep ? "غیرفعال" : "فعال",
            //           },
            //         ],
            //         [{ text: "بازگشت" }],
            //       ],
            //       resize_keyboard: true,
            //       one_time_keyboard: false,
            //       is_persistent: true,
            //     },
            //   },
            // );
            await reply(
              ctx,
              next,
              redisClient,
              `${"حالت خواب"}: ${
                existingUser.sleep ? "فعال" : "غیرفعال"
              }\n\n${"اگر حالت خواب فعال باشد ، لایکی دریافت نمیکنید"}`,
              [
                [
                  {
                    text: existingUser.sleep ? "غیرفعال" : "فعال",
                  },
                ],
                [{ text: "بازگشت" }],
              ],
            );
          } catch (error) {
            console.log({ error });
          }
        }
      } else if (userStep === "notificationSleepMode") {
        if (ctx?.message?.text === "بازگشت") {
          try {
            existingUser.userStep = "notificationMenu";
            // await existingUser.save();
            usersMap.set(telegramId, {
              time: Date.now(),
              user: existingUser,
            });

            // await ctx.reply(
            //   `${"افرادی شما را لایک کردند. یه نگاهی بنداز "}\n\n1. ${"نمایش"}\n2. ${"حالت خواب"}`,
            //   {
            //     reply_markup: {
            //       keyboard: [[{ text: "1 🚀" }, { text: "2" }]],
            //       resize_keyboard: true,
            //       one_time_keyboard: false,
            //       is_persistent: true,
            //     },
            //   },
            // );
            await reply(
              ctx,
              next,
              redisClient,
              `${"افرادی شما را لایک کردند. یه نگاهی بنداز "}\n\n1. ${"نمایش"}\n2. ${"حالت خواب"}`,
              [[{ text: "1 🚀" }, { text: "2" }]],
            );
          } catch (error) {
            console.log({ error });
          }
        } else if (
          ctx?.message?.text === "فعال" ||
          ctx?.message?.text === "غیرفعال"
        ) {
          try {
            existingUser.userStep = "notificationMenu";
            const sleppStatus = !existingUser.sleep;
            existingUser.sleep = sleppStatus;
            // save in redis
            await redisClient.hmset(`user:${telegramId}`, {
              sleep: sleppStatus,
            });
            usersMap.set(telegramId, {
              time: Date.now(),
              user: existingUser,
            });
            // await existingUser.save();

            // await ctx.reply("✅");
            await reply(ctx, next, redisClient, "✅");
            // await ctx.reply(
            //   `${"افرادی شما را لایک کردند. یه نگاهی بنداز "}\n\n1. ${"نمایش"}\n2. ${"حالت خواب"}`,
            //   {
            //     reply_markup: {
            //       keyboard: [[{ text: "1 🚀" }, { text: "2" }]],
            //       resize_keyboard: true,
            //       one_time_keyboard: false,
            //       is_persistent: true,
            //     },
            //   },
            // );
            await reply(
              ctx,
              next,
              redisClient,
              `${"افرادی شما را لایک کردند. یه نگاهی بنداز "}\n\n1. ${"نمایش"}\n2. ${"حالت خواب"}`,
              [[{ text: "1 🚀" }, { text: "2" }]],
            );
          } catch (error) {
            console.log({ error });
          }
        } else {
          try {
            // await ctx.reply(
            //   `${"حالت خواب"}: ${
            //     existingUser.sleep ? "فعال" : "غیرفعال"
            //   }\n\n${"اگر حالت خواب فعال باشد ، لایکی دریافت نمیکنید"}`,
            //   {
            //     reply_markup: {
            //       keyboard: [
            //         [
            //           {
            //             text: existingUser.sleep ? "غیرفعال" : "فعال",
            //           },
            //         ],
            //         [{ text: "بازگشت" }],
            //       ],
            //       resize_keyboard: true,
            //       one_time_keyboard: false,
            //       is_persistent: true,
            //     },
            //   },
            // );
            await reply(
              ctx,
              next,
              redisClient,
              `${"حالت خواب"}: ${
                existingUser.sleep ? "فعال" : "غیرفعال"
              }\n\n${"اگر حالت خواب فعال باشد ، لایکی دریافت نمیکنید"}`,
              [
                [
                  {
                    text: existingUser.sleep ? "غیرفعال" : "فعال",
                  },
                ],
                [{ text: "بازگشت" }],
              ],
            );
          } catch (error) {
            console.log({ error });
          }
        }
      } else if (userStep === "notificationMenu") {
        if (ctx?.message?.text === "1 🚀") {
          try {
            const updatedUser = await User.findOneAndUpdate(
              { telegramId },
              { userStep: "notifications" },
              { returnDocument: "after" },
            );

            usersMap.set(telegramId, {
              time: Date.now(),
              user: updatedUser,
            });

            await reply(
              ctx,
              next,
              redisClient,
              "افراد زیر شما را لایک کرده اند 🥰👇🏽\n\nهر کدام را لایک کنید به او متصل میشوید و میتوانید با او چت کنید 🗨️ \n\nدر حال پردازش ...",
              [[{ text: "❌" }, { text: "❤️" }]],
            );

            const getData = await redisClient.getBuffer(`newLikes`);

            if (Buffer.isBuffer(getData)) {
              // const userRoot = await protobuf.load(
              //   "./protoBuf_files/newLike.proto",
              // );

              // let NewLikeProto = userRoot.lookupType("Users");
              await loadNewLikeProto();
              const decodedMessage = NewLikeProto.decode(getData);
              let usersArrayFromRedis = decodedMessage.users || [];
              const userFromRedis = usersArrayFromRedis.find(
                (user) => +user.telegramId === +telegramId,
              );
              if (
                userFromRedis &&
                Array.isArray(userFromRedis.likers) &&
                userFromRedis.likers.length > 0
              ) {
                const photos = userFromRedis.likers[0].profileImages;
                const fullName = userFromRedis.likers[0].fullName;
                const age = userFromRedis.likers[0].age;
                const state = userFromRedis.likers[0].state;
                const bio = userFromRedis.likers[0].bio;
                const textMessage = userFromRedis.likers[0]?.message;
                const inviteCode_ =
                  userFromRedis.likers[0].inviteCode;

                try {
                  // const buffer = await getPic(photos[0]);
                  await ctx.replyWithPhoto(photos[0], {
                    caption: `${fullName}, ${age}, ${state} ${
                      bio ? "\n" + bio : ""
                    } ${textMessage ? `\n\nپیام کاربر به شما 💌 : ` : ""}${textMessage ? textMessage : ""} \n/user_${inviteCode_ || "not_found"}`,
                  });
                } catch (error) {
                  try {
                    await reply(
                      ctx,
                      next,
                      redisClient,
                      `${fullName}, ${age}, ${state} ${
                        bio ? "\n" + bio : ""
                      } ${textMessage ? `\n\nپیام کاربر به شما 💌 : ` : ""}${textMessage ? textMessage : ""} \n/user_${inviteCode_ || "not_found"}`,
                    );
                  } catch (error) {
                    console.log(error);
                  }
                }
              }
            } else {
              try {
                // await ctx.reply("شما لایکی ندارید");
                await reply(
                  ctx,
                  next,
                  redisClient,
                  "شما لایکی ندارید",
                );
              } catch (error) {
                console.log(error);
              }
            }
          } catch (error) {
            console.log(error);
          }
        } else if (ctx?.message?.text === "2") {
          try {
            existingUser.userStep = "notificationSleepMode";
            // await existingUser.save();
            usersMap.set(telegramId, {
              time: Date.now(),
              user: existingUser,
            });

            // await ctx.reply(
            //   `${"حالت خواب"}: ${
            //     existingUser.sleep ? "فعال" : "غیرفعال"
            //   }\n\n${"اگر حالت خواب فعال باشد ، لایکی دریافت نمیکنید"}`,
            //   {
            //     reply_markup: {
            //       keyboard: [
            //         [
            //           {
            //             text: existingUser.sleep ? "غیرفعال" : "فعال",
            //           },
            //         ],
            //         [{ text: "بازگشت" }],
            //       ],
            //       resize_keyboard: true,
            //       one_time_keyboard: false,
            //       is_persistent: true,
            //     },
            //   },
            // );
            await reply(
              ctx,
              next,
              redisClient,
              `${"حالت خواب"}: ${
                existingUser.sleep ? "فعال" : "غیرفعال"
              }\n\n${"اگر حالت خواب فعال باشد ، لایکی دریافت نمیکنید"}`,
              [
                [
                  {
                    text: existingUser.sleep ? "غیرفعال" : "فعال",
                  },
                ],
                [{ text: "بازگشت" }],
              ],
            );
          } catch (error) {
            console.log(error);
          }
        } else {
          try {
            // await ctx.reply(
            //   `${"افرادی شما را لایک کردند. یه نگاهی بنداز "}\n\n1. ${"نمایش"}\n2. ${"حالت خواب"}`,
            //   {
            //     reply_markup: {
            //       keyboard: [[{ text: "1 🚀" }, { text: "2" }]],
            //       resize_keyboard: true,
            //       one_time_keyboard: false,
            //       is_persistent: true,
            //     },
            //   },
            // );
            await reply(
              ctx,
              next,
              redisClient,
              `${"افرادی شما را لایک کردند. یه نگاهی بنداز "}\n\n1. ${"نمایش"}\n2. ${"حالت خواب"}`,
              [[{ text: "1 🚀" }, { text: "2" }]],
            );
          } catch (error) {
            console.log(error);
          }
        }
      } else if (userStep === "notifications") {
        // if user is not have username ask to fill it <<<<<<<<<<<<<<
        // if user is not have username ask to fill it <<<<<<<<<<<<<<
        if (!userName) {
          try {
            try {
              await ctx.replyWithPhoto(
                "https://nodejs-x695j4.chbk.dev/uploads/username.jpg",
                {
                  caption:
                    "برای استفاده از ربات حتما باید یک شناسه کاربری (آیدی) در بله داشته باشید ، یک نام کاربری برای خود انتخاب کنید و سپس مجددا امتحان کنید \n حساب کاربری --> شناسه کاربری",
                  reply_markup: {
                    inline_keyboard: [
                      [
                        {
                          text: "انجام دادم ✅",
                          callback_data: "done_start",
                        },
                      ],
                    ],
                  },
                },
              );
            } catch (error) {
              try {
                await reply(
                  ctx,
                  next,
                  redisClient,
                  "برای استفاده از ربات حتما باید یک شناسه کاربری (آیدی) در بله داشته باشید ، یک نام کاربری برای خود انتخاب کنید و سپس مجددا امتحان کنید \n حساب کاربری --> شناسه کاربری",
                  [],
                  [
                    [
                      {
                        text: "انجام دادم ✅",
                        callback_data: "done_start",
                      },
                    ],
                  ],
                );
              } catch (error) {
                console.log(error);
              }
            }
            return;
          } catch (e) {
            try {
              await reply(
                ctx,
                next,
                redisClient,
                "برای استفاده از ربات حتما باید یک شناسه کاربری (آیدی) در بله داشته باشید ، یک نام کاربری برای خود انتخاب کنید و سپس مجددا امتحان کنید \n حساب کاربری --> شناسه کاربری",
              );
            } catch (error) {
              console.log(error);
            }
          }
        }
        // if user is not have username ask to fill it >>>>>>>>>>>>>>
        // if user is not have username ask to fill it >>>>>>>>>>>>>>
        if (ctx?.message?.text === "❤️") {
          try {
            temporaryDailyReport.totalOfMatches += 1;
            if (!existingUser.matches) existingUser.matches = [];
            const getData = await redisClient.getBuffer(`newLikes`);

            // console.log("notif step 1 ---", { getData });
            if (Buffer.isBuffer(getData)) {
              // const userRoot = await protobuf.load(
              //   "./protoBuf_files/newLike.proto",
              // );

              // let NewLikeProto = userRoot.lookupType("Users");
              await loadNewLikeProto();
              const decodedMessage = NewLikeProto.decode(getData);
              let usersArrayFromRedis = decodedMessage.users || [];
              // console.log({ usersArrayFromRedis });
              const userFromRedis = usersArrayFromRedis.find(
                (user) => +user.telegramId === +telegramId,
              );

              if (
                userFromRedis &&
                Array.isArray(userFromRedis.likers) &&
                userFromRedis.likers.length > 0
              ) {
                const liker = userFromRedis.likers[0];
                const likerTelegramId = liker.telegramId;
                const photos =
                  userFromRedis.likers[0]?.profileImages || [];
                const fullName =
                  userFromRedis.likers[0]?.fullName || "";
                const likerUserName =
                  userFromRedis.likers[0]?.userName || "";
                const age = userFromRedis.likers[0]?.age || "";
                const state = userFromRedis.likers[0]?.state || "";
                const bio = userFromRedis.likers[0]?.bio || "";
                const textMessage = userFromRedis.likers[0]?.message;

                try {
                  const matchesCountStr =
                    (await redisClient.hget(
                      `user:${telegramId}`,
                      "matchesCount",
                    )) || "0";

                  const updatedMatchesCount =
                    parseInt(matchesCountStr) + 1;

                  await redisClient.hset(
                    `user:${telegramId}`,
                    "matchesCount",
                    updatedMatchesCount.toString(),
                  );
                } catch (error) {
                  console.log(error);
                }

                try {
                  const matchesCountContactStr =
                    (await redisClient.hget(
                      `user:${+likerTelegramId}`,
                      "matchesCount",
                    )) || "0";

                  const updatedMatchesContactCount =
                    parseInt(matchesCountContactStr) + 1;

                  await redisClient.hset(
                    `user:${+likerTelegramId}`,
                    "matchesCount",
                    updatedMatchesContactCount.toString(),
                  );
                } catch (error) {
                  console.log(error);
                }

                try {
                  if (!existingUser.matches)
                    existingUser.matches = [];
                  if (
                    (existingUser?.subscriptionExpireTime &&
                      existingUser.subscriptionExpireTime >
                        Date.now()) ||
                    existingUser.gender == "female" ||
                    existingUser.matches.length <= 3
                  ) {
                    await reply(
                      ctx,
                      next,
                      redisClient,
                      ` ${"شما و"} ${fullName} ${"با همدیگر مطابقت داده شده‌اید!"} 🎉\n\n${"از طریق دکمه زیر می‌توانید با هم چت کنید:"} \n\n آیدی کاربر : @${likerUserName}\n\n/user_${generateInviteCode(likerTelegramId)}`,
                      [],
                      [
                        [
                          {
                            text: "شروع چت 💬",
                            url: `https://ble.ir/${likerUserName}?text=${"سلام"} ${fullName} ${"من از پونس هستم"}`,
                          },
                        ],
                      ],
                    );
                  } else {
                    await reply(
                      ctx,
                      next,
                      redisClient,
                      ` ${"شما و"} ${fullName} ${"با همدیگر مطابقت داده شده‌اید!"} 🎉\n\n${"از طریق دکمه زیر می‌توانید با هم چت کنید:"} \n\n آیدی کاربر : ********\n\n/user_${generateInviteCode(likerTelegramId)} \n\n⭕برای دریافت پیوی (صفحه چت خصوصی) کاربر باید اشتراک 💎پرو داشته باشد`,
                      [],
                      [
                        [
                          {
                            text: "خرید اشتراک 💎پرو",
                            callback_data: "buy_like",
                          },
                        ],
                      ],
                    );
                  }
                } catch (error) {
                  console.log(error);
                }
                try {
                  let getLiker;
                  if (usersMap.get(+likerTelegramId)) {
                    getLiker = usersMap.get(+likerTelegramId).user;
                  } else {
                    getLiker = await User.findOne({
                      telegramId: +likerTelegramId,
                    });
                  }
                  if (!getLiker.matches) getLiker.matches = [];
                  if (
                    (getLiker?.subscriptionExpireTime &&
                      getLiker.subscriptionExpireTime > Date.now()) ||
                    getLiker.gender == "female" ||
                    getLiker.matches.length <= 3
                  ) {
                    await replyBot(
                      likerTelegramId,
                      redisClient,
                      ` ${"شما و"} ${existingUser?.fullName} ${"با همدیگر مطابقت داده شده‌اید!"} 🎉\n\n${"از طریق دکمه زیر می‌توانید با هم چت کنید:"} \n\n آیدی کاربر : @${userName}\n\n /user_${generateInviteCode(telegramId)}`,
                      [],
                      [
                        [
                          {
                            text: "شروع چت 💬",
                            url: `https://ble.ir/${userName}?text=${"سلام"} ${existingUser?.fullName} ${"من از پونس هستم"}`,
                          },
                        ],
                      ],
                    );
                  } else {
                    await replyBot(
                      likerTelegramId,
                      redisClient,
                      ` ${"شما و"} ${existingUser?.fullName} ${"با همدیگر مطابقت داده شده‌اید!"} 🎉\n\n${"از طریق دکمه زیر می‌توانید با هم چت کنید:"} \n\n آیدی کاربر :************\n\n /user_${generateInviteCode(telegramId)} \n\n⭕برای دریافت پیوی (صفحه چت خصوصی) کاربر باید اشتراک 💎پرو داشته باشد`,
                      [],
                      [
                        [
                          {
                            text: "خرید اشتراک 💎پرو",
                            callback_data: "buy_like",
                          },
                        ],
                      ],
                    );
                  }
                } catch (error) {
                  console.log(error);
                }

                try {
                  // save in matches in db -----------------------------
                  // پیدا کردن ایندکس کاربر موجود با telegramId
                  const existingMatchIndex =
                    existingUser.matches.findIndex(
                      (match) =>
                        match.telegramId === +likerTelegramId,
                    );

                  if (existingMatchIndex !== -1) {
                    // اگر وجود داشت، به ایندکس 0 منتقل شود
                    const existingMatch = existingUser.matches.splice(
                      existingMatchIndex,
                      1,
                    )[0];
                    existingUser.matches.unshift(existingMatch);
                  } else {
                    // اگر وجود نداشت، اضافه شود
                    existingUser.matches.unshift({
                      telegramId: +likerTelegramId,
                      fullName,
                      userName: likerUserName,
                      age,
                      state,
                      bio,
                      profileImages: photos,
                    });
                  }
                } catch (error) {
                  console.log(error);
                }

                try {
                  usersMap.set(telegramId, {
                    time: Date.now(),
                    user: existingUser,
                  });

                  let findContact;

                  if (usersMap.get(+likerTelegramId)) {
                    findContact = usersMap.get(+likerTelegramId).user;
                    usersMap.get(+likerTelegramId).time =
                      getNowTime();
                  } else {
                    findContact = await User.findOne({
                      telegramId: +likerTelegramId,
                    });
                  }

                  if (findContact) {
                    if (!Array.isArray(findContact?.matches))
                      findContact.matches = [];
                    // پیدا کردن ایندکس کاربر موجود با telegramId
                    const existingMatchIndex =
                      findContact.matches.findIndex(
                        (match) => match.telegramId === +telegramId,
                      );

                    if (existingMatchIndex !== -1) {
                      // اگر وجود داشت، به ایندکس 0 منتقل شود
                      const existingMatch =
                        findContact.matches.splice(
                          existingMatchIndex,
                          1,
                        )[0];
                      findContact.matches.unshift(existingMatch);
                    } else {
                      // اگر وجود نداشت، اضافه شود
                      findContact.matches.unshift({
                        telegramId: +telegramId,
                        fullName: existingUser?.fullName || "",
                        userName: existingUser?.userName || "",
                        age: existingUser?.age || "",
                        state: existingUser?.state || "",
                        bio: existingUser?.bio || "",
                        profileImages:
                          existingUser?.profileImages || "",
                      });
                    }

                    if (usersMap.get(+likerTelegramId)) {
                      usersMap.set(+likerTelegramId, {
                        user: findContact,
                      });
                    } else {
                      await findContact.save({
                        optimisticConcurrency: false,
                      });
                    }
                  }

                  usersMap.set(+likerTelegramId, {
                    time: Date.now(),
                    user: findContact,
                  });
                } catch (error) {
                  console.log(error);
                }
                // end save in matches in db -------------------------

                // delete from list ----------------------------------
                const list = userFromRedis.likers;
                if (Array.isArray(list)) {
                  list.shift(); // فقط آیتم اول حذف می‌شود
                  // forYouList.set(telegramId, list); // دوباره در map قرار می‌دهیم (اختیاری)

                  const updatedUsersArray = usersArrayFromRedis.map(
                    (user) => {
                      if (+user.telegramId === +telegramId) {
                        return {
                          ...user,
                          likers: list,
                          time: Date.now(),
                        };
                      }
                      return user;
                    },
                  );

                  const message_ = NewLikeProto.create({
                    users: updatedUsersArray,
                  });
                  const buffer =
                    NewLikeProto.encode(message_).finish();
                  await redisClient.set(`newLikes`, buffer);
                }
                // end delete from list ------------------------------

                // show nextUser -------------------------------------
                if (list[0]) {
                  const photos = list[0].profileImages;
                  const fullName = list[0].fullName;
                  const age = list[0].age;
                  const state = list[0].state;
                  const bio = list[0].bio;
                  const inviteCode_ = list[0].inviteCode;
                  const textMessage = list[0]?.message;

                  try {
                    // const buffer = await getPic(photos[0]);
                    await ctx.replyWithPhoto(photos[0], {
                      caption: `${fullName}, ${age}, ${state} ${
                        bio ? "\n" + bio : ""
                      } ${textMessage ? `\n\nپیام کاربر به شما 💌 : ` : ""}${textMessage ? textMessage : ""} \n/user_${inviteCode_ || "not_found"}`,
                    });
                  } catch (error) {
                    try {
                      await reply(
                        ctx,
                        next,
                        redisClient,
                        `${fullName}, ${age}, ${state} ${
                          bio ? "\n" + bio : ""
                        } ${textMessage ? `\n\nپیام کاربر به شما 💌 : ` : ""}${textMessage ? textMessage : ""} \n/user_${inviteCode_ || "not_found"}`,
                      );
                    } catch (error) {
                      console.log(error);
                    }
                  }
                } else {
                  try {
                    // await ctx.reply("پایان لایک ها");
                    await reply(
                      ctx,
                      next,
                      redisClient,
                      "پایان لایک ها",
                    );
                    existingUser.userStep = "menu";

                    usersMap.set(telegramId, {
                      time: Date.now(),
                      user: existingUser,
                    });

                    await reply(
                      ctx,
                      next,
                      redisClient,
                      `1. ${"مشاهده پروفایل ها"}\n2. ${"پروفایل من"}\n3. ${"حالت خواب"}\n----------------------------\n4. ${"دوستان خود را دعوت کنید تا لایک های بیشتری دریافت کنید 😎"}`,
                      [
                        [
                          { text: "1 🚀" },
                          { text: "2" },
                          { text: "3" },
                          { text: "4" },
                        ],
                      ],
                    );
                  } catch (error) {
                    console.log(error);
                  }
                }
                // end show nextUser ---------------------------------

                // await ctx.reply(
                //   `<a href="https://ble.ir/${"Abolfazl021aaaa"}?text=سلام ${fullName}، از طریق تلگرام با شما آشنا شدم 😊">💬 شروع چت</a>`,
                //   { parse_mode: "HTML" },
                // );
              } else {
                // console.log("notif step 3-1 ---");
                try {
                  // await ctx.reply("پایان لایک ها");
                  await reply(
                    ctx,
                    next,
                    redisClient,
                    "پایان لایک ها",
                  );
                  existingUser.userStep = "menu";
                  usersMap.set(telegramId, {
                    time: Date.now(),
                    user: existingUser,
                  });
                  await reply(
                    ctx,
                    next,
                    redisClient,
                    `1. ${"مشاهده پروفایل ها"}\n2. ${"پروفایل من"}\n3. ${"حالت خواب"}\n----------------------------\n4. ${"دوستان خود را دعوت کنید تا لایک های بیشتری دریافت کنید 😎"}`,
                    [
                      [
                        { text: "1 🚀" },
                        { text: "2" },
                        { text: "3" },
                        { text: "4" },
                      ],
                    ],
                  );
                } catch (error) {
                  console.log(error);
                }

                return;
              }
            } else {
              try {
                await reply(
                  ctx,
                  next,
                  redisClient,
                  "شما لایکی ندارید",
                );
              } catch (error) {
                console.log(error);
              }
            }
          } catch (error) {
            console.log(error);
          }
        } else if (ctx?.message?.text === "❌") {
          try {
            const getData = await redisClient.getBuffer(`newLikes`);

            // console.log("notif step 1 ---", { getData });
            if (Buffer.isBuffer(getData)) {
              // const userRoot = await protobuf.load(
              //   "./protoBuf_files/newLike.proto",
              // );

              // let NewLikeProto = userRoot.lookupType("Users");
              await loadNewLikeProto();
              const decodedMessage = NewLikeProto.decode(getData);
              let usersArrayFromRedis = decodedMessage.users || [];
              // console.log({ usersArrayFromRedis });
              const userFromRedis = usersArrayFromRedis.find(
                (user) => +user.telegramId === +telegramId,
              );
              if (
                userFromRedis &&
                Array.isArray(userFromRedis.likers) &&
                userFromRedis.likers.length > 0
              ) {
                // delete from list ----------------------------------
                const list = userFromRedis.likers;
                try {
                  if (Array.isArray(list)) {
                    list.shift(); // فقط آیتم اول حذف می‌شود
                    // forYouList.set(telegramId, list); // دوباره در map قرار می‌دهیم (اختیاری)

                    const updatedUsersArray = usersArrayFromRedis.map(
                      (user) => {
                        if (+user.telegramId === +telegramId) {
                          return {
                            ...user,
                            likers: list,
                            time: Date.now(),
                          };
                        }
                        return user;
                      },
                    );

                    const message_ = NewLikeProto.create({
                      users: updatedUsersArray,
                    });
                    const buffer =
                      NewLikeProto.encode(message_).finish();
                    await redisClient.set(`newLikes`, buffer);
                  }
                } catch (error) {
                  console.log(error);
                }
                // end delete from list ------------------------------

                // show nextUser -------------------------------------
                if (list[0]) {
                  const photos = list[0].profileImages;
                  const fullName = list[0].fullName;
                  const age = list[0].age;
                  const state = list[0].state;
                  const bio = list[0].bio;
                  const inviteCode_ = list[0].inviteCode;
                  const textMessage = list[0]?.message;

                  try {
                    // const buffer = await getPic(photos[0]);
                    await ctx.replyWithPhoto(
                      photos[0],

                      {
                        caption: `${fullName}, ${age}, ${state} ${
                          bio ? "\n" + bio : ""
                        } ${textMessage ? `\n\nپیام کاربر به شما 💌 : ` : ""}${textMessage ? textMessage : ""} \n/user_${inviteCode_ || "not_found"}`,
                      },
                    );
                  } catch (error) {
                    try {
                      // await ctx.reply(
                      //   `${fullName}, ${age}, ${state} ${
                      //     bio ? "\n" + bio : ""
                      //   } \n/user_${inviteCode_ || "not_found"}`,
                      // );
                      await reply(
                        ctx,
                        next,
                        redisClient,
                        `${fullName}, ${age}, ${state} ${
                          bio ? "\n" + bio : ""
                        } ${textMessage ? `\n\nپیام کاربر به شما 💌 : ` : ""}${textMessage ? textMessage : ""} \n/user_${inviteCode_ || "not_found"}`,
                      );
                    } catch (error) {
                      console.log(error);
                    }
                  }
                } else {
                  try {
                    // await ctx.reply("پایان لایک ها");
                    await reply(
                      ctx,
                      next,
                      redisClient,
                      "پایان لایک ها",
                    );
                    existingUser.userStep = "menu";

                    usersMap.set(telegramId, {
                      time: Date.now(),
                      user: existingUser,
                    });
                    await reply(
                      ctx,
                      next,
                      redisClient,
                      `1. ${"مشاهده پروفایل ها"}\n2. ${"پروفایل من"}\n3. ${"حالت خواب"}\n----------------------------\n4. ${"دوستان خود را دعوت کنید تا لایک های بیشتری دریافت کنید 😎"}`,
                      [
                        [
                          { text: "1 🚀" },
                          { text: "2" },
                          { text: "3" },
                          { text: "4" },
                        ],
                      ],
                    );
                  } catch (error) {
                    console.log(error);
                  }
                }
                // end show nextUser ---------------------------------

                // await ctx.reply(
                //   `<a href="https://ble.ir/${"Abolfazl021aaaa"}?text=سلام ${fullName}، از طریق تلگرام با شما آشنا شدم 😊">💬 شروع چت</a>`,
                //   { parse_mode: "HTML" },
                // );
              } else {
                // console.log("notif step 3-1 ---");
                try {
                  // await ctx.reply("پایان لایک ها");
                  await reply(
                    ctx,
                    next,
                    redisClient,
                    "پایان لایک ها",
                  );
                  existingUser.userStep = "menu";
                  usersMap.set(telegramId, {
                    time: Date.now(),
                    user: existingUser,
                  });
                  await reply(
                    ctx,
                    next,
                    redisClient,
                    `1. ${"مشاهده پروفایل ها"}\n2. ${"پروفایل من"}\n3. ${"حالت خواب"}\n----------------------------\n4. ${"دوستان خود را دعوت کنید تا لایک های بیشتری دریافت کنید 😎"}`,
                    [
                      [
                        { text: "1 🚀" },
                        { text: "2" },
                        { text: "3" },
                        { text: "4" },
                        //{ text: "5" },
                      ],
                    ],
                  );
                } catch (error) {
                  console.log(error);
                }

                return;
              }
            } else {
              try {
                await reply(
                  ctx,
                  next,
                  redisClient,
                  "شما لایکی ندارید",
                );
              } catch (error) {
                console.log(error);
              }
            }
          } catch (error) {
            console.log(error);
          }
        } else {
          try {
            await reply(ctx, next, redisClient, "لایک ها :", [
              [{ text: "❌" }, { text: "❤️" }],
            ]);
          } catch (error) {
            console.log(error);
          }
        }
      } else if (userStep === "likeWithMessage") {
        if (ctx?.message?.text == "بازگشت") {
          existingUser.userStep = "search";
          usersMap.set(telegramId, {
            time: Date.now(),
            user: existingUser,
          });

          try {
            await reply(ctx, next, redisClient, "🔎", [
              [
                { text: "☰" },
                { text: "❤️" },
                { text: "❌" },
                { text: "💌" },
              ],
            ]);
            const nextUser = forYouList.get(telegramId)?.[0];
if (!nextUser) {
  await reply(ctx, next, redisClient, "کاربری برای نمایش وجود ندارد");
  return;
}
            const {
              fullName,
              age,
              state,
              bio,
              profileImages,
              inviteCode: inviteCode_from_forYouList,
            } = nextUser;
            userTelId = forYouList.get(telegramId)[0].telegramId;

            const photos = profileImages;
            await ctx.replyWithPhoto(photos[0], {
              caption: `${fullName}, ${age}, ${state} ${
                bio ? "\n" + bio : ""
              } \n/user_${inviteCode_from_forYouList || "not_found"}`,
            });
          } catch (error) {
            try {
              const nextUser = forYouList.get(telegramId)?.[0];
if (!nextUser) {
  await reply(ctx, next, redisClient, "کاربری برای نمایش وجود ندارد");
  return;
}
              const {
                fullName,
                age,
                state,
                bio,
                profileImages,
                inviteCode: inviteCode_from_forYouList,
              } = nextUser;
              userTelId = forYouList.get(telegramId)[0].telegramId;
              await reply(
                ctx,
                next,
                redisClient,
                `${fullName}, ${age}, ${state} ${
                  bio ? "\n" + bio : ""
                } \n/user_${inviteCode_from_forYouList || "not_found"}`,
              );
            } catch (error) {
              console.log(error);
            }
          }
        } else if (
          ctx?.message?.text &&
          ctx?.message?.text != "❌" &&
          ctx?.message?.text != "💌" &&
          ctx?.message?.text != "❤️"
        ) {
          if (
            forYouList.get(telegramId) &&
            forYouList.get(telegramId)[0]
          ) {
            // newLike for notification
            newLikeQueue.add({
              telegramId: +forYouList.get(telegramId)[0]?.telegramId,
              liker: existingUser,
              message: ctx?.message?.text,
            });
          } else {
            console.log("liker id notfoundddd -------------");
          }

          if (!existingUser.firstLike) {
            try {
              await reply(
                ctx,
                next,
                redisClient,
                "❤️ : لایک\n❌ : رد کردن\n💌 : لایک به همراه پیام\n☰ : منو\n\nوقتی کاربری را لایک میکنید ، لایک شما برای او ارسال میشود و اگر اوهم شما را لایک کند ، متصل میشوید .",
              );
              existingUser.firstLike = 1;
              usersMap.set(telegramId, {
                time: Date.now(),
                user: existingUser,
              });
            } catch (error) {
              console.log(error);
            }
          }

          const targetId = forYouList.get(telegramId)?.[0]?.telegramId
            ? +forYouList.get(telegramId)?.[0]?.telegramId
            : 0;
          const fullItem = forYouList.get(telegramId)?.[0];

          // console.log("--> ", forYouList.get(telegramId)?.[0]);

          globalOperationsQueue.add({
            type: "like",
            data: {
              telegramId,
              targetId: +targetId,
              fullItem,
            },
          });

          existingUser.userStep = "search";
          usersMap.set(telegramId, {
            time: Date.now(),
            user: existingUser,
          });

          await reply(
            ctx,
            next,
            redisClient,
            "لایک شما به همراه پیام ارسال شد ✅",
            [
              [
                { text: "☰" },
                { text: "❤️" },
                { text: "❌" },
                { text: "💌" },
              ],
            ],
          );

          const list = forYouList.get(telegramId);
          if (Array.isArray(list)) {
            list.shift(); // فقط آیتم اول حذف می‌شود
            forYouList.set(telegramId, list); // دوباره در map قرار می‌دهیم (اختیاری)
          }

          const nextUser = forYouList.get(telegramId)?.[0];
          if (!nextUser) {
            await reply(
              ctx,
              next,
              redisClient,
              "کاربری برای نمایش وجود ندارد",
            );
            return;
          }

          const {
            fullName,
            age,
            state,
            bio,
            profileImages,
            inviteCode: inviteCode_from_forYouList,
          } = nextUser;
          userTelId = forYouList.get(telegramId)[0].telegramId;

          const photos = profileImages;

          try {
            // const buffer = await getPic(photos[0]);
            await ctx.replyWithPhoto(
              photos[0],
              // {
              //   source:
              //     fs.existsSync(photos[0]) &&
              //     fs.createReadStream(photos[0]),
              // },
              {
                caption: `${fullName}, ${age}, ${state} ${
                  bio ? "\n" + bio : ""
                } \n/user_${inviteCode_from_forYouList || "not_found"}`,
              },
            );
          } catch (error) {
            try {
              // await ctx.reply(
              //   `${fullName}, ${age}, ${state} ${
              //     bio ? "\n" + bio : ""
              //   } \n/user_${inviteCode_from_forYouList || "not_found"}`,
              // );
              await reply(
                ctx,
                next,
                redisClient,
                `${fullName}, ${age}, ${state} ${
                  bio ? "\n" + bio : ""
                } \n/user_${inviteCode_from_forYouList || "not_found"}`,
              );
            } catch (error) {
              console.log(error);
            }
          }

          existingUser.lastViewed =
            +forYouList.get(telegramId)[0].telegramId; // نیاز به ذخیره کردنش نیست
          usersMap.set(telegramId, {
            time: Date.now(),
            user: existingUser,
          });
        } else {
          try {
            // await ctx.reply("لطفا فقط پیام متنی ارسال کنید.");
            await reply(
              ctx,
              next,
              redisClient,
              "لطفا فقط پیام متنی ارسال کنید.",
            );
          } catch (error) {
            console.log(error);
          }
        }
      } else if (userStep === "answer") {
        if (ctx?.message?.text === "بازگشت") {
          existingUser.userStep = "menu";
          usersMap.set(telegramId, {
            time: Date.now(),
            user: existingUser,
          });
          try {
            await reply(
              ctx,
              next,
              redisClient,
              `1. ${"مشاهده پروفایل ها"}\n2. ${"پروفایل من"}\n3. ${"حالت خواب"}\n----------------------------\n4. ${"دوستان خود را دعوت کنید تا لایک های بیشتری دریافت کنید 😎"}`,
              [
                [
                  { text: "1 🚀" },
                  { text: "2" },
                  { text: "3" },
                  { text: "4" },
                ],
              ],
            );
          } catch (error) {
            console.log(error);
          }

          return;
        } else if (ctx?.message?.text) {
          if (!existingUser.lastAnsweredMessage) {
            try {
              await reply(
                ctx,
                next,
                redisClient,
                "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)",
              );
            } catch (error) {
              console.log(error);
            }

            return;
          }
          try {
            if (!existingUser.blocksMe) existingUser.blocksMe = [];
            const amIBlock = existingUser.blocksMe.find(
              (f) => f == existingUser.lastAnsweredMessage,
            );
            if (amIBlock) {
              await replyBot(
                existingUser.lastAnsweredMessage,
                redisClient,
                "شما توسط این کاربر بلاک شده اید 🫸🏻",
              );
              return;
            }

            try {
              await replyBot(
                existingUser.lastAnsweredMessage,
                redisClient,
                `${"شما یک پیام جدید از"} ${
                  existingUser.fullName
                } دارید :\n\n${ctx?.message?.text}\n/user_${
                  generateInviteCode(telegramId) || "not_found"
                }`,
                [],
                [
                  [
                    {
                      text: `پاسخ`,
                      callback_data: `answer_message_${telegramId}`,
                    },
                  ],
                ],
              );
            } catch (error) {
              console.log(error);
            }
            existingUser.userStep = "search";
            usersMap.set(telegramId, {
              time: Date.now(),
              user: existingUser,
            });
            // await existingUser.save();

            try {
              await reply(
                ctx,
                next,
                redisClient,
                "پیام شما ارسال شد ✅",
                [
                  [
                    { text: "☰" },
                    { text: "❤️" },
                    { text: "❌" },
                    { text: "💌" },
                  ],
                ],
              );

              const nextUser = forYouList.get(telegramId)?.[0];
if (!nextUser) {
  await reply(ctx, next, redisClient, "کاربری برای نمایش وجود ندارد");
  return;
}

              const {
                fullName,
                age,
                state,
                bio,
                profileImages,
                inviteCode: inviteCode_from_forYouList,
              } = nextUser;
              userTelId = forYouList.get(telegramId)[0].telegramId;

              const photos = profileImages;

              await ctx.replyWithPhoto(photos[0], {
                caption: `${fullName}, ${age}, ${state} ${
                  bio ? "\n" + bio : ""
                } \n/user_${inviteCode_from_forYouList || "not_found"}`,
              });
            } catch (error) {
              try {
                const nextUser = forYouList.get(telegramId)?.[0];
if (!nextUser) {
  await reply(ctx, next, redisClient, "کاربری برای نمایش وجود ندارد");
  return;
}
                const {
                  fullName,
                  age,
                  state,
                  bio,
                  inviteCode: inviteCode_from_forYouList,
                } = nextUser;

                await reply(
                  ctx,
                  next,
                  redisClient,
                  `${fullName}, ${age}, ${state} ${
                    bio ? "\n" + bio : ""
                  } \n/user_${inviteCode_from_forYouList || "not_found"}`,
                );
              } catch (error) {
                console.log(error);
              }
            }

            existingUser.lastViewed =
              +forYouList.get(telegramId)[0].telegramId; // نیاز به ذخیره کردنش نیست
            usersMap.set(telegramId, {
              time: Date.now(),
              user: existingUser,
            });
          } catch (error) {
            console.log(error);
          }
        } else {
          try {
            // await ctx.reply("لطفا فقط پیام متنی ارسال کنید.");
            await reply(
              ctx,
              next,
              redisClient,
              "لطفا فقط پیام متنی ارسال کنید.",
            );
          } catch (error) {
            console.log(error);
          }
        }
      } else if (userStep === "userProfile") {
        if (ctx?.message?.text === "گزارش") {
          try {
            await reply(
              ctx,
              next,
              redisClient,
              `${"چرا میخوای این کاربر را گزارش کنی؟"} /user_${generateInviteCode(+existingUser?.lastViewedByInviteCode)}`,
              [],
              [
                [
                  {
                    text: "تبلیغات", // "تبلیغات"
                    callback_data: `report_advertisement`,
                  },
                ],
                [
                  {
                    text: "ارسال محتوای غیر اخلاقی", // "ارسال محتوای غیر اخلاقی"
                    callback_data: `report_inappropriate_content`,
                  },
                ],
                [
                  {
                    text: "ایجاد مزاحمت", // "ایجاد مزاحمت"
                    callback_data: `report_harassment`,
                  },
                ],
                [
                  {
                    text: "پخش شماره موبایل یا اطلاعات شخصی دیگران", // "پخش شماره موبایل یا اطلاعات شخصی دیگران"
                    callback_data: `report_phone_number`,
                  },
                ],
                [
                  {
                    text: "کلمات یا عکس غیراخلاقی در پروفایل", // "کلمات یا عکس غیراخلاقی در پروفایل"
                    callback_data: `report_inappropriate_profile`,
                  },
                ],
                [
                  {
                    text: "جنسیت اشتباه در پروقایل", // "جنسیت اشتباه در پروقایل"
                    callback_data: `report_incorrect_gender`,
                  },
                ],
                [
                  {
                    text: "دیگر موارد ...", // "دیگر موارد ..."
                    callback_data: `report_other`,
                  },
                ],
              ],
            );
          } catch (error) {
            console.log(error);
          }
        } else if (ctx?.message?.text === "بلاک") {
          try {
            await reply(
              ctx,
              next,
              redisClient,
              "کاربر بلاک شد ✅\n\n- شما دیگر پیام های این کاربر را دریافت نخواهید کرد\n- این کاربر دیگر در لیست کاربران پیشنهادی به شما نمایش داده نمی شود",
            );

            // delete from forYouList
            try {
              const current = forYouList.get(telegramId) ?? [];
              forYouList.set(
                telegramId,
                current.filter(
                  (f) =>
                    f.telegramId !=
                    existingUser.lastViewedByInviteCode,
                ),
              );
            } catch (error) {
              console.log(error);
            }

            existingUser.userStep = "menu";
            if (existingUser.blockedByMe) {
              const findBlock = existingUser.blockedByMe.find(
                (f) => f == existingUser.lastViewedByInviteCode,
              );
              if (!findBlock) {
                existingUser.blockedByMe = [
                  ...existingUser.blockedByMe,
                  existingUser.lastViewedByInviteCode,
                ];
              }
            } else {
              if (existingUser.lastViewedByInviteCode)
                existingUser.blockedByMe = [
                  existingUser.lastViewedByInviteCode,
                ];
            }
            usersMap.set(telegramId, {
              time: Date.now(),
              user: existingUser,
            });

            try {
              let contact;
              if (
                usersMap.get(+existingUser.lastViewedByInviteCode)
              ) {
                contact = usersMap.get(
                  +existingUser.lastViewedByInviteCode,
                ).user;
              } else {
                contact = await User.findOne({
                  telegramId: +existingUser.lastViewedByInviteCode,
                });
              }
              if (!contact.blocksMe) contact.blocksMe = [];
              const findBlockInContact = contact.blocksMe.find(
                (f) => f == telegramId,
              );
              if (!findBlockInContact) {
                contact.blocksMe = [...contact.blocksMe, +telegramId];
              }
              usersMap.set(+existingUser.lastViewedByInviteCode, {
                time: Date.now(),
                user: contact,
              });
            } catch (error) {
              console.log(error);
            }

            try {
              await reply(
                ctx,
                next,
                redisClient,
                `1. ${"مشاهده پروفایل ها"}\n2. ${"پروفایل من"}\n3. ${"حالت خواب"}\n----------------------------\n4. ${"دوستان خود را دعوت کنید تا لایک های بیشتری دریافت کنید 😎"}`,
                [
                  [
                    { text: "1 🚀" },
                    { text: "2" },
                    { text: "3" },
                    { text: "4" },
                  ],
                ],
              );
            } catch (error) {
              console.log(error);
            }
          } catch (error) {
            console.log(error);
          }
        } else if (ctx?.message?.text === "آنبلاک") {
          try {
            await reply(ctx, next, redisClient, "کاربر آنبلاک شد ✅");
            existingUser.userStep = "menu";
            if (existingUser.blockedByMe) {
              const findBlock = existingUser.blockedByMe.find(
                (f) => f == existingUser.lastViewedByInviteCode,
              );
              if (findBlock) {
                existingUser.blockedByMe =
                  existingUser.blockedByMe.filter(
                    (f) => f != existingUser.lastViewedByInviteCode,
                  );
              }
            } else {
              if (existingUser.lastViewedByInviteCode)
                existingUser.blockedByMe = [];
            }
            usersMap.set(telegramId, {
              time: Date.now(),
              user: existingUser,
            });

            try {
              let contact;
              if (
                usersMap.get(+existingUser.lastViewedByInviteCode)
              ) {
                contact = usersMap.get(
                  +existingUser.lastViewedByInviteCode,
                ).user;
              } else {
                contact = await User.findOne({
                  telegramId: +existingUser.lastViewedByInviteCode,
                });
              }
              if (!contact.blocksMe) contact.blocksMe = [];
              const findBlockInContact = contact.blocksMe.find(
                (f) => f == telegramId,
              );
              if (findBlockInContact) {
                contact.blocksMe = contact.blocksMe.filter(
                  (f) => f != +existingUser.lastViewedByInviteCode,
                );
              }
              usersMap.set(+existingUser.lastViewedByInviteCode, {
                time: Date.now(),
                user: contact,
              });
            } catch (error) {
              console.log(error);
            }

            try {
              await reply(
                ctx,
                next,
                redisClient,
                `1. ${"مشاهده پروفایل ها"}\n2. ${"پروفایل من"}\n3. ${"حالت خواب"}\n----------------------------\n4. ${"دوستان خود را دعوت کنید تا لایک های بیشتری دریافت کنید 😎"}`,
                [
                  [
                    { text: "1 🚀" },
                    { text: "2" },
                    { text: "3" },
                    { text: "4" },
                  ],
                ],
              );
            } catch (error) {
              console.log(error);
            }
          } catch (error) {
            console.log(error);
          }
        } else if (ctx?.message?.text === "بازگشت به منوی اصلی") {
          existingUser.userStep = "menu";
          usersMap.set(telegramId, {
            time: Date.now(),
            user: existingUser,
          });
          try {
            await reply(
              ctx,
              next,
              redisClient,
              `1. ${"مشاهده پروفایل ها"}\n2. ${"پروفایل من"}\n3. ${"حالت خواب"}\n----------------------------\n4. ${"دوستان خود را دعوت کنید تا لایک های بیشتری دریافت کنید 😎"}`,
              [
                [
                  { text: "1 🚀" },
                  { text: "2" },
                  { text: "3" },
                  { text: "4" },
                ],
              ],
            );
          } catch (error) {
            console.log(error);
          }
        } else {
          existingUser.userStep = "menu";
          usersMap.set(telegramId, {
            time: Date.now(),
            user: existingUser,
          });
          try {
            // await ctx.reply(
            //   `1. ${"مشاهده پروفایل ها"}\n2. ${"پروفایل من"}\n3. ${"حالت خواب"}\n----------------------------\n4. ${"دوستان خود را دعوت کنید تا لایک های بیشتری دریافت کنید 😎"}`,
            //   {
            //     reply_markup: {
            //       keyboard: [
            //         [
            //           { text: "1 🚀" },
            //           { text: "2" },
            //           { text: "3" },
            //           { text: "4" },
            //         ],
            //       ],
            //       resize_keyboard: true,
            //       one_time_keyboard: false,
            //       is_persistent: true,
            //     },
            //   },
            // );
            await reply(
              ctx,
              next,
              redisClient,
              `1. ${"مشاهده پروفایل ها"}\n2. ${"پروفایل من"}\n3. ${"حالت خواب"}\n----------------------------\n4. ${"دوستان خود را دعوت کنید تا لایک های بیشتری دریافت کنید 😎"}`,
              [
                [
                  { text: "1 🚀" },
                  { text: "2" },
                  { text: "3" },
                  { text: "4" },
                ],
              ],
            );
          } catch (error) {
            console.log(error);
          }
        }
      }
    } else {
      if (inviteCode) {
        const inviteByUser = await User.findOne({ inviteCode });
        if (!inviteByUser) return; // ← این خط نیست
        inviteByUser.giftLikeCount += 50;
        try {
          await inviteByUser.save();
          if (!+inviteByUser.telegramId) return;
          await replyBot(
            inviteByUser.telegramId,
            redisClient,
            "ممون از دعوت شما . 50 لایک هدیه دریافت کردید 😎💕",
          );
        } catch (error) {
          console.log(error);
        }

        if (usersMap.get(+inviteByUser.telegramId)) {
          usersMap.get(+inviteByUser.telegramId).user.giftLikeCount +=
            50;
          usersMap.set(+inviteByUser.telegramId, {
            user: usersMap.get(+inviteByUser.telegramId).user,
            time: Date.now(),
          });
        }
      }

      const saveduser = await User.create({
        telegramId,
        userName,
        inviteCode: generateInviteCode(telegramId),
        inviteBy: inviteCode || null,
      });

      await registerInBot(
        ctx,
        next,
        ages,
        chunkArray,
        telegramId,
        telegramName,
        saveduser,
        redisClient,
        forYouList,
        forYouTime,
        activeUsersQueue,
        ActiveUsersProto,
      );
    }
  } catch (error) {
    console.log(error);
  }
};

bot.start(async (ctx, next) => {
  try {
    console.log("/start :", ctx.from.id, ctx.from?.username);
    await processStatement(ctx, next);
  } catch (error) {
    console.log(error);
  }
});

bot.command("matches", async (ctx, next) => {
  try {
    const findUser = await User.findOne({ telegramId: ctx.from.id });
    if (findUser) {
      if (findUser.subscriptionExpireTime > Date.now()) {
        let matches = findUser.matches
          ? findUser.matches.slice(0, 50)
          : [];
        if (matches.length) {
          let matchesStr = "مچ ها (matches) 👇🏽😎\n\n";
          matches.map((m) => {
            matchesStr += `${m.fullName} ,${m.age} ,${m.state} ,@${m.userName} \n/user_${generateInviteCode(m.telegramId)}\n-------------------------------------------------\n`;
          });
          await reply(ctx, next, redisClient, matchesStr);
        } else {
          await reply(
            ctx,
            next,
            redisClient,
            "شما هنوز با هیچ کاربری مطابقت داده نشده اید .",
          );
        }
      } else {
        await reply(
          ctx,
          next,
          redisClient,
          "فقط کاربران 💎پرو به این بخش دسترسی دارند \n\nبا خرید اشتراک 💎پرو میتوانید مچ (matches) های خود را مشاهده کنید 😎👇🏽",
          [],
          [
            [
              {
                text: "خرید اشتراک پرو 💎",
                callback_data: "buy_like",
              },
            ],
          ],
        );
      }
    } else {
      await reply(
        ctx,
        next,
        redisClient,
        "ابتدا ثبت نام کنید \n\n /start\nstart\n/start",
      );
    }
  } catch (error) {
    console.log(error);
  }
});

bot.action(/answer_message_(.+)/, async (ctx, next) => {
  try {
    await ctx.answerCbQuery();
    const telegramId = ctx.match[1];

    let existingUser =
      usersMap.get(ctx.from.id)?.user ??
      (await User.findOne({ telegramId: ctx.from.id }));

    if (!existingUser) return;

    existingUser.userStep = "answer";
    existingUser.lastAnsweredMessage = +telegramId;
    usersMap.set(ctx.from.id, {
      user: existingUser,
      time: Date.now(),
    });

    await reply(
      ctx,
      next,
      redisClient,
      "پیام خود را ارسال کنید 🧐👇🏽",
      [[{ text: "بازگشت" }]],
    );
  } catch (error) {
    console.error(error);
  }
});

bot.hears(/\/user_(.+)/, async (ctx, next) => {
  const userId = ctx.match[1]; // مقدار بعد از user_
  const telegramId___ = ctx.from.id;

  let existingUser;
  try {
    const findUser = await User.findOne({ inviteCode: userId });
    if (!userId || userId === "not_found" || !findUser) {
      try {
        await reply(ctx, next, redisClient, "کاربر یافت نشد");
      } catch (error) {
        console.log(error);
      }

      return;
    }
    const {
      fullName,
      age,
      state,
      profileImages,
      bio,
      telegramId,
      inviteCode,
    } = findUser;

    if (usersMap.get(telegramId___)) {
      existingUser = usersMap.get(telegramId___).user;
      existingUser.userStep = "userProfile";
      existingUser.lastViewedByInviteCode = +telegramId;
      usersMap.set(telegramId___, {
        user: existingUser,
        time: Date.now(),
      });
    } else {
      existingUser = await User.findOneAndUpdate(
        { telegramId: telegramId___ },
        {
          userStep: "userProfile",
          lastViewedByInviteCode: +telegramId,
        },
        { returnDocument: "after" },
      );
      usersMap.set(telegramId___, {
        user: existingUser,
        time: Date.now(),
      });
    }

    const photo = profileImages[0];
    const blockedByMee = existingUser?.blockedByMe || [];
    const findBlock = blockedByMee.find((f) => f == +telegramId);

    try {
      await ctx.replyWithPhoto(photo, {
        caption: `${fullName}, ${age}, ${state} ${
          bio ? "\n" + bio : ""
        }\n/user_${userId || "not_found"}`,
        reply_markup: {
          keyboard: [
            [
              {
                text: "گزارش",
              },
              {
                text: findBlock ? "آنبلاک" : "بلاک",
              },
            ],
            [
              {
                text: "بازگشت به منوی اصلی",
              },
            ],
          ],
          resize_keyboard: true,
          is_persistent: true,
        },
      });
    } catch (error) {
      try {
        await reply(
          ctx,
          next,
          redisClient,
          `${fullName}, ${age}, ${state} ${
            bio ? "\n" + bio : ""
          }\n/user_${userId || "not_found"}`,
          [
            [
              {
                text: "گزارش",
              },
              {
                text: findBlock ? "آنبلاک" : "بلاک",
              },
            ],
            [
              {
                text: "بازگشت به منوی اصلی",
              },
            ],
          ],
        );
      } catch (error) {
        console.log(error);
      }
    }
  } catch (error) {
    console.log(error);
  }
});

bot.on("message", async (ctx, next) => {
  try {
    await processStatement(ctx, next);
  } catch (error) {
    console.log(error);
  }
});

bot.action("buy_like", async (ctx, next) => {
  await reply(
    ctx,
    next,
    redisClient,
    "💎 اشتراک پرو + ❤️ لایک اضافه \n\nیه پکیج انتخاب کن:",
    [],
    [
      [
        {
          text: "1 ماهه + 500 لایک  --  249,000 تومان",
          callback_data: "buy_like_1",
        },
      ],
      [
        {
          text: "1 ماهه + 1000 لایک  --  369,000 تومان",
          callback_data: "buy_like_2",
        },
      ],
      [
        {
          text: "3 ماهه + 1500 لایک  --  539,000 تومان",
          callback_data: "buy_like_3",
        },
      ],
      [
        {
          text: "3 ماهه + 2500 لایک  --  739,000 تومان",
          callback_data: "buy_like_4",
        },
      ],
      [
        {
          text: "6 ماهه + 5000 لایک  --  999,000 تومان",
          callback_data: "buy_like_5",
        },
      ],
    ],
  );
});

bot.action("buy_like_1", async (ctx) => {
  try {
    await ctx.sendInvoice({
      chat_id: ctx.chat.id,
      title: "💎 اشتراک پرو + 500 لایک اضافه",
      description: "💎 اشتراک پرو (یک ماهه) + 500 لایک اضافه",
      payload: `like1_${ctx.from.id}`,
      provider_token: "WALLET-l5dCPuAvjRjSLcEk", //pounesbot
      // provider_token: "WALLET-yccFFyEwkUfWA3BR",
      prices: [{ label: "اشتراک پونس", amount: 2490000 }],
      // prices: [{ label: "اشتراک پونس", amount: 10000 }],
    });
  } catch (e) {
    console.error("Error during sendInvoice:", e);
    await ctx.reply("خطا در ارسال صورتحساب");
  }
});

bot.action("buy_like_2", async (ctx) => {
  try {
    await ctx.sendInvoice({
      chat_id: ctx.chat.id,
      title: "💎 اشتراک پرو + 1000 لایک اضافه",
      description: "💎 اشتراک پرو (یک ماهه) + 1000 لایک اضافه",
      payload: `like2_${ctx.from.id}`,
      provider_token: "WALLET-l5dCPuAvjRjSLcEk", //pounesbot
      // provider_token: "WALLET-yccFFyEwkUfWA3BR",
      prices: [{ label: "اشتراک پونس", amount: 3690000 }],
    });
  } catch (e) {
    console.error("Error during sendInvoice:", e);
    await ctx.reply("خطا در ارسال صورتحساب");
  }
});
bot.action("buy_like_3", async (ctx) => {
  try {
    await ctx.sendInvoice({
      chat_id: ctx.chat.id,
      title: "💎 اشتراک پرو + 1500 لایک اضافه",
      description: "💎 اشتراک پرو (سه ماهه) + 1500 لایک اضافه",
      payload: `like3_${ctx.from.id}`,
      provider_token: "WALLET-l5dCPuAvjRjSLcEk", //pounesbot
      // provider_token: "WALLET-yccFFyEwkUfWA3BR",
      prices: [{ label: "اشتراک پونس", amount: 5390000 }],
    });
  } catch (e) {
    console.error("Error during sendInvoice:", e);
    await ctx.reply("خطا در ارسال صورتحساب");
  }
});
bot.action("buy_like_4", async (ctx) => {
  try {
    await ctx.sendInvoice({
      chat_id: ctx.chat.id,
      title: "💎 اشتراک پرو + 2500 لایک اضافه",
      description: "💎 اشتراک پرو (سه ماهه) + 2500 لایک اضافه",
      payload: `like4_${ctx.from.id}`,
      provider_token: "WALLET-l5dCPuAvjRjSLcEk", //pounesbot
      // provider_token: "WALLET-yccFFyEwkUfWA3BR",
      prices: [{ label: "اشتراک پونس", amount: 7390000 }],
    });
  } catch (e) {
    console.error("Error during sendInvoice:", e);
    await ctx.reply("خطا در ارسال صورتحساب");
  }
});
bot.action("buy_like_5", async (ctx) => {
  try {
    await ctx.sendInvoice({
      chat_id: ctx.chat.id,
      title: "💎 اشتراک پرو + 5000 لایک اضافه",
      description: "💎 اشتراک پرو (شش ماهه) + 5000 لایک اضافه",
      payload: `like5_${ctx.from.id}`,
      provider_token: "WALLET-l5dCPuAvjRjSLcEk", //pounesbot
      // provider_token: "WALLET-yccFFyEwkUfWA3BR",
      prices: [{ label: "اشتراک پونس", amount: 9990000 }],
    });
  } catch (e) {
    console.error("Error during sendInvoice:", e);
    await ctx.reply("خطا در ارسال صورتحساب");
  }
});

bot.on("pre_checkout_query", async (ctx) => {
  try {
    const q = ctx.update.pre_checkout_query;
    console.log({ q: q.from.id, q2: q.invoice_payload });

    // بررسی payload
    if (!q.invoice_payload || !q.invoice_payload.startsWith("like")) {
      return await ctx.answerPreCheckoutQuery(
        false,
        "payload نامعتبر است.",
      );
    }

    // بررسی کاربر - باید قبل از هر عملیاتی باشد
    const userIdFromPayload = q.invoice_payload.split("_")[1];
    if (String(q.from.id) !== String(userIdFromPayload)) {
      return await ctx.answerPreCheckoutQuery(
        false,
        "کاربر پرداخت‌کننده با سفارش مطابقت ندارد.",
      );
    }

    // تعریف پکیج‌ها
    const packages = {
      like1: {
        giftLikeCount: 500,
        days: 30,
        expectedAmount: 2490000,
      },
      like2: {
        giftLikeCount: 1000,
        days: 30,
        expectedAmount: 3690000,
      },
      like3: {
        giftLikeCount: 1500,
        days: 90,
        expectedAmount: 5390000,
      },
      like4: {
        giftLikeCount: 2500,
        days: 90,
        expectedAmount: 7390000,
      },
      like5: {
        giftLikeCount: 5000,
        days: 180,
        expectedAmount: 9990000,
      },
    };

    const packageKey = Object.keys(packages).find((key) =>
      q.invoice_payload.startsWith(`${key}_`),
    );

    if (!packageKey) {
      return await ctx.answerPreCheckoutQuery(
        false,
        "پکیج نامعتبر است.",
      );
    }

    const pkg = packages[packageKey];

    // بررسی مبلغ - قبل از save
    if (q.total_amount !== pkg.expectedAmount) {
      return await ctx.answerPreCheckoutQuery(
        false,
        "مبلغ سفارش نادرست است.",
      );
    }

    // ذخیره در دیتابیس
    const daysInMs = pkg.days * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const findUser = await User.findOne({ telegramId: q.from.id });
    if (!findUser) {
      return await ctx.answerPreCheckoutQuery(
        false,
        "کاربر یافت نشد.",
      );
    }

    if (!Array.isArray(findUser.payments)) findUser.payments = [];

    findUser.giftLikeCount += pkg.giftLikeCount;
    findUser.subscriptionExpireTime =
      findUser.subscriptionExpireTime > now
        ? findUser.subscriptionExpireTime + daysInMs
        : now + daysInMs;

    findUser.payments.push({ time: now, fee: q.total_amount });

    await findUser.save();

    return await ctx.answerPreCheckoutQuery(true);
  } catch (err) {
    console.error("pre_checkout_query error:", err);
    try {
      await ctx.answerPreCheckoutQuery(false, "خطا در تأیید پرداخت.");
    } catch (_) {}
  }
});

bot.action("done_start", async (ctx, next) => {
  try {
    await ctx.answerCbQuery(); // حذف لودینگ دکمه

    // شبیه‌سازی اجرای دستور /start
    await bot.handleUpdate({
      update_id: Date.now(),
      message: {
        message_id: Date.now(),
        from: ctx.from,
        chat: ctx.chat,
        date: Math.floor(Date.now() / 1000),
        text: "/start",
      },
    });
  } catch (error) {
    console.log(error);
  }
});

const reportAction = async (reportType, telegramId___, ctx, next) => {
  try {
    let existingUser;

    if (usersMap.get(telegramId___)) {
      existingUser = usersMap.get(telegramId___).user;
    } else {
      existingUser = await User.findOne({
        telegramId: telegramId___,
      });
    }

    if (!existingUser || !existingUser.telegramId) {
      try {
        // await ctx.reply("کاربر یافت نشد.");
        await reply(ctx, next, redisClient, "کاربر یافت نشد.");
      } catch (error) {
        console.log(error);
      }

      return;
    }

    if (
      !existingUser.lastViewedByInviteCode &&
      !Number(existingUser.lastViewedByInviteCode)
    )
      return;
    const reportedId =
      existingUser.lastViewedByInviteCode &&
      +existingUser.lastViewedByInviteCode; // مقدار بعد از report_

    let report = await Report.findOne({ telegramId: reportedId });
    if (!report) {
      report = await Report.create({ telegramId: reportedId });
    }
    if (
      report.reports.find(
        (report) => report.reportedTelegramId === telegramId___,
      )
    ) {
      try {
        // await ctx.reply("شما قبلا برای این کاربر گزارش داده اید.");
        await reply(
          ctx,
          next,
          redisClient,
          "شما قبلا برای این کاربر گزارش داده اید.",
        );
      } catch (error) {}

      return;
    }
    report.reports.push({
      type: reportType,
      reportedTelegramId: telegramId___,
    });
    try {
      await report.save();
      await reply(ctx, next, redisClient, "گزارش شما ثبت شد ✅");
    } catch (error) {}

    existingUser.userStep = "menu";
    usersMap.set(telegramId___, {
      user: existingUser,
      time: Date.now(),
    });
    try {
      await reply(
        ctx,
        next,
        redisClient,
        `1. ${"مشاهده پروفایل ها"}\n2. ${"پروفایل من"}\n3. ${"حالت خواب"}\n----------------------------\n4. ${"دوستان خود را دعوت کنید تا لایک های بیشتری دریافت کنید 😎"}`,
        [
          [
            { text: "1 🚀" },
            { text: "2" },
            { text: "3" },
            { text: "4" },
          ],
        ],
      );
    } catch (error) {
      console.log(error);
    }
  } catch (error) {
    console.log(error);
  }
};

bot.action("report_advertisement", async (ctx, next) => {
  await reportAction("report_advertisement", ctx.from.id, ctx, next);
});
bot.action("report_inappropriate_content", async (ctx, next) => {
  await reportAction(
    "report_inappropriate_content",
    ctx.from.id,
    ctx,
    next,
  );
});
bot.action("report_harassment", async (ctx, next) => {
  await reportAction("report_harassment", ctx.from.id, ctx, next);
});
bot.action("report_phone_number", async (ctx, next) => {
  await reportAction("report_phone_number", ctx.from.id, ctx, next);
});
bot.action("report_inappropriate_profile", async (ctx, next) => {
  await reportAction(
    "report_inappropriate_profile",
    ctx.from.id,
    ctx,
    next,
  );
});
bot.action("report_incorrect_gender", async (ctx, next) => {
  await reportAction(
    "report_incorrect_gender",
    ctx.from.id,
    ctx,
    next,
  );
});
bot.action("report_other", async (ctx, next) => {
  await reportAction("report_other", ctx.from.id, ctx, next);
});

bot.launch();

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
