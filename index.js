const { Telegraf } = require("telegraf");
const { message } = require("telegraf/filters");
const express = require("express");
const cors = require("cors");
const { languages, texts } = require("./data/languages");
const fs = require("fs");

const { registerInBot } = require("./components/registerInBot.js");
const editProfileInBot = require("./components/editProfileInBot.js");
const { changePhoto } = require("./components/changePhoto.js");

const http = require("http");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const User = require("./models/User");
const protobuf = require("protobufjs");
const usersMap = require("./utils/usersMap");
const forYouList = require("./utils/forYouList");

const countries = require("./data/countries.json");
require("dotenv").config();

const bot = require("./utils/bot.js");
const {
  redisClient,
  globalOperationsQueue,
  foryouQueue,
  suggestQueue,
  newLikeQueue,
} = require("./config/redis");

const app = express();

const {
  globalOperationsQueueController,
} = require("./queue/globlaQueue");
const { suggestQueueController } = require("./queue/suggestQueue.js");
const { foryouQueueController } = require("./queue/foryouQueue.js");
const { newLikeQueueController } = require("./queue/newLikeQueue.js");
const { default: axios } = require("axios");

const {
  generateInviteCode,
} = require("./utils/generateInviteCode.js");
const Report = require("./models/Report.js");
const Pictures = require("./models/Pictures.js");
const chunkArray = require("./utils/chunkArray.js");
const checkNewLikesForSendNotif = require("./tools/CheckNewLikesForSendNotif.js");
const cleanupOldUsersFromMapAndSaveToDB = require("./tools/CleanupOldUsersFromMapAndSaveToDB.js");
const editProfileMenu = require("./components/userSteps/editProfileMenu.js");
const searchStep = require("./components/userSteps/searchStep.js");
const adminRoutes = require("./routes/adminRoutes");
const showMainMenu = require("./components/showMainMenu");
const fakeUsersRouter = require("./routes/fakeUersRouter");
const menuStep = require("./components/userSteps/menuStep.js");

const server = http.createServer(app, {});

mongoose
  .connect(
    "mongodb://root:EOYcwZU9ulmklCPQ0TaNIqKw@etna.liara.cloud:33903/my-app?authSource=admin",
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
app.options("*", cors()); // پاسخ به OPTIONS request

const PORT = 6338;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`server is running on port ${PORT}`);
});

// middleware for adding redisClient to req
app.use((req, res, next) => {
  req.redisClient = redisClient;
  next();
});

// Routes
app.use("/", adminRoutes);
app.use("/", fakeUsersRouter);

foryouQueue.process(5, async (job) => {
  const { telegramId } = job.data;
  try {
    await foryouQueueController({ telegramId });
  } catch (error) {
    console.error("Error processing explore queue:", error);
  }
});

suggestQueue.process(5, async (job) => {
  const { telegramId, user } = job.data;
  try {
    await suggestQueueController({ telegramId, user });
  } catch (error) {
    console.error("Error processing explore queue:", error);
  }
});

newLikeQueue.process(5, async (job) => {
  const { telegramId, liker } = job.data;
  try {
    await newLikeQueueController({ telegramId, liker });
  } catch (error) {
    console.error("Error processing explore queue:", error);
  }
});

globalOperationsQueue.process(10, async (job) => {
  const { type, data } = job.data;
  try {
    await globalOperationsQueueController({ type, data });
  } catch (error) {
    console.error("Error processing global operations queue:", error);
  }
});

// current time
let cachedTime = Date.now();
setInterval(() => {
  cachedTime = Date.now();
}, 5000);
function getNowTime() {
  return cachedTime;
}

// check for new likes every 1 houre and send notification <<<
setInterval(async () => {
  await checkNewLikesForSendNotif();
}, 10000);
// }, 3600000);
// check for new likes every 1 houre and send notification >>>

const ages = Array.from({ length: 63 }, (_, i) => 18 + i); // [18, 19, ..., 70]

const lastTimeAddProfileToList = new Map();

const forYouTime = new Map();

// check and cleanup old users from map and save to mongoDB every 30 minutes <<<
async function startCleanup() {
  await cleanupOldUsersFromMapAndSaveToDB();
  setTimeout(startCleanup, 30 * 60 * 1000); // 30 دقیقه
}
setTimeout(() => {
  startCleanup();
}, 10000);
// check and cleanup old users from map and save to mingoDB every 30 minutes >>>

// generate invite link <<<<<<<<<<<<<<<<<<<<
const generateInviteLink = (telegramId) => {
  return `https://ble.ir/pounes_dating_bot?start=${generateInviteCode(
    telegramId,
  )}`;
};
// generate invite link >>>>>>>>>>>>>>>>>>>>

const processStatement = async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const telegramName = ctx.from.first_name;
    const userName = ctx.from.username;
    const isBot = ctx.from.is_bot;
    const inviteCode = ctx.startPayload;

    if (isBot || !telegramId) return;

    // set existingUser <<<<<<<<<<<<<<<<<<<<<<<<<<<<<
    let existingUser;
    if (usersMap.get(telegramId)) {
      existingUser = usersMap.get(telegramId).user;
      usersMap.get(telegramId).time = getNowTime();
    } else {
      existingUser = await User.findOne({ telegramId });
      if (existingUser) {
        usersMap.set(telegramId, {
          user: existingUser,
          time: getNowTime(),
        });
      }
    }
    // set existingUser >>>>>>>>>>>>>>>>>>>>>>>>>>>>>

    // check if user is banned cant use bot <<<
    if (existingUser?.ban) {
      await ctx.reply("شما مسدود شده اید");
      return;
    }
    // check if user is banned cant use bot >>>

    // if user is not have username ask to fill it <<<<<<<<<
    if (!userName) {
      try {
        try {
          ctx.replyWithPhoto(
            {
              source: fs.createReadStream(
                "public/uploads/username.jpg",
              ),
            },
            {
              caption:
                "برای استفاده از ربات حتما باید یک شناسه کاربری (آیدی) در بله داشته باشید ، یک نام کاربری برای خود انتخاب کنید و سپس مجددا امتحان کنید \n حساب کاربری -> شناسه کاربری",
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
            await ctx.reply(
              "برای استفاده از ربات حتما باید یک شناسه کاربری (آیدی) در بله داشته باشید ، یک نام کاربری برای خود انتخاب کنید و سپس مجددا امتحان کنید \n حساب کاربری -> شناسه کاربری",
              {
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
            console.log(error);
          }
        }
        return;
      } catch (e) {
        try {
          ctx.reply(
            "برای استفاده از ربات حتما باید یک شناسه کاربری (آیدی) در بله داشته باشید ، یک نام کاربری برای خود انتخاب کنید و سپس مجددا امتحان کنید \n حساب کاربری -> شناسه کاربری",
          );
        } catch (error) {
          console.log(error);
        }
      }
    }
    // if user is not have username ask to fill it >>>>>>>>>

    // if user changed userName update it in database <<<
    if (existingUser && userName !== existingUser?.userName) {
      const updatedUser = await User.findOneAndUpdate(
        { telegramId },
        { userName: userName || "" },
      );
      usersMap.set(telegramId, {
        user: updatedUser,
        time: getNowTime(),
      });
    }
    // if user changed userName update it in database >>>

    // check if user exist in database and after 8 minutes and 20 seconds add profile to forYou queue again <<<
    if (existingUser) {
      // after 8 minutes and 20 seconds add profile to forYou queue again and update last time <<<
      const lastTime = lastTimeAddProfileToList.get(telegramId);
      if (lastTime) {
        const userStep = existingUser?.userStep || "register";
        if (userStep !== "register") {
          if (lastTime + 500000 < Date.now()) {
            lastTimeAddProfileToList.set(telegramId, Date.now());
            foryouQueue.add({ telegramId });
          }
        }
        // after 8 minutes and 20 seconds add profile to forYou queue again and update last time >>>
      } else {
        // add profile to foryou and update last time <<<
        const userStep = existingUser?.userStep || "register";
        if (userStep !== "register") {
          foryouQueue.add({ telegramId });
          lastTimeAddProfileToList.set(telegramId, Date.now());
        }
        // add profile to foryou and update last time >>>
      }
    }
    // check if user exist in database and after 8 minutes and 20 seconds add profile to forYou queue again >>>

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
        const lookFor =
          existingUser.gender === "male" ? "female" : "male";
        const getDataGlobal = await redisClient.getBuffer(
          `globalUsers:${lookFor.toLowerCase()}`,
        );

        if (Buffer.isBuffer(getDataGlobal)) {
          const userRoot = await protobuf.load(
            "./protoBuf_files/foryou.proto",
          );
          const ForyouProto = userRoot.lookupType("Users");
          const decodedMessage = ForyouProto.decode(getDataGlobal);
          const usersArrayFromRedis = decodedMessage.users || [];
          const subArray = usersArrayFromRedis.slice(0, 10);

          forYouList.set(telegramId, subArray);
        }

        forYouTime.set(telegramId, Date.now());

        // Add to search queue
        suggestQueue.add({
          telegramId,
          user: existingUser,
        });
      }

      // Check if forYou list needs to be refilled and refill if necessary and add to suggestQueue >>>
      if (userStep === "register") {
        await registerInBot(
          ctx,
          ages,
          chunkArray,
          telegramId,
          telegramName,
          existingUser,
          redisClient,
          forYouList,
          forYouTime,
          suggestQueue,
          foryouQueue,
        );
      } else if (userStep === "editProfileMenu") {
        await editProfileMenu(
          ctx,
          telegramId,
          existingUser,
          usersMap,
          forYouList,
          forYouTime,
          suggestQueue,
          ages,
        );
      } else if (userStep === "editProfile") {
        editProfileInBot(
          ctx,
          chunkArray,
          ages,
          telegramId,
          existingUser,
          redisClient,
          forYouList,
          forYouTime,
          suggestQueue,
          foryouQueue,
          telegramName,
        );
      } else if (userStep === "changePhoto") {
        await changePhoto(
          ctx,
          telegramId,
          existingUser,
          redisClient,
          forYouList,
          forYouTime,
          suggestQueue,
        );
      } else if (userStep === "search") {
        await searchStep(
          ctx,
          telegramId,
          existingUser,
          usersMap,
          forYouList,
          forYouTime,
          suggestQueue,
        );

        if (ctx?.message?.text === "☰") {
          await showMainMenu(ctx, telegramId, existingUser, usersMap);
        } else if (ctx?.message?.text === "❤️") {
          if (
            forYouList.get(telegramId) &&
            forYouList.get(telegramId)[0]
          ) {
            // newLike for notification
            newLikeQueue.add({
              telegramId: +forYouList.get(telegramId)[0].telegramId,
              liker: existingUser,
            });
          }

          if (!existingUser.firstLike) {
            await ctx.reply(
              "❤️ : لایک\n❌ : (رد کردن)نوپ\n💌 : پیام\n☰ : منو\n\nوقتی کاربری را لایک میکنید ، لایک شما برای او ارسال میشود و اگر اوهم شما را لایک کند ، متصل میشوید .",
            );
            existingUser.firstLike = 1;
            usersMap.set(telegramId, {
              time: Date.now(),
              user: existingUser,
            });
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
              targetId,
              fullItem,
            },
          });

          const list = forYouList.get(telegramId);
          if (Array.isArray(list)) {
            list.shift(); // فقط آیتم اول حذف می‌شود
            forYouList.set(telegramId, list); // دوباره در map قرار می‌دهیم (اختیاری)
          }

          const {
            fullName,
            age,
            state,
            flag,
            bio,
            profileImages,
            inviteCode: inviteCode_from_forYouList,
          } = forYouList.get(telegramId)[0];
          userTelId = forYouList.get(telegramId)[0].telegramId;

          const photos = profileImages;

          try {
            await ctx.replyWithPhoto(
              {
                source: fs.createReadStream(photos[0]),
              },
              {
                caption: `${fullName}, ${age}, ${state} ${
                  bio ? "\n" + bio : ""
                } \n/user_${inviteCode_from_forYouList || "not_found"}`,
              },
            );
          } catch (error) {
            try {
              await ctx.reply(
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
            await ctx.reply(
              "❤️ : لایک\n❌ : (رد کردن)نوپ\n💌 : پیام\n☰ : منو\n\nوقتی کاربری را لایک میکنید ، لایک شما برای او ارسال میشود و اگر اوهم شما را لایک کند ، متصل میشوید .",
            );
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
              targetId,
            },
          });

          const list = forYouList.get(telegramId);
          if (Array.isArray(list)) {
            list.shift(); // فقط آیتم اول حذف می‌شود
            forYouList.set(telegramId, list); // دوباره در map قرار می‌دهیم (اختیاری)
          }

          const {
            fullName,
            age,
            state,
            flag,
            bio,
            profileImages,
            inviteCode: inviteCode_from_forYouList,
          } = forYouList.get(telegramId)[0];
          userTelId = forYouList.get(telegramId)[0].telegramId;

          const photos = profileImages;

          try {
            await ctx.replyWithPhoto(
              {
                source: fs.createReadStream(photos[0]),
              },
              {
                caption: `${fullName}, ${age}, ${state} ${
                  bio ? "\n" + bio : ""
                } \n/user_${inviteCode_from_forYouList || "not_found"}`,
              },
            );
          } catch (error) {
            try {
              await ctx.reply(
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
          existingUser.userStep = "directMessage";
          usersMap.set(telegramId, {
            time: Date.now(),
            user: existingUser,
          });
          // await existingUser.save();
          ctx.reply("پیام خود را ارسال کنید 🧐👇🏽");
        } else {
          ctx.reply("🧐👇🏽", {
            reply_markup: {
              keyboard: [
                [
                  { text: "💌" },
                  { text: "❌" },
                  { text: "❤️" },
                  { text: "☰" },
                ],
              ],
              resize_keyboard: true,
              is_persistent: true,
            },
          });
        }
      } else if (userStep === "menu") {
        await menuStep(
          ctx,
          existingUser,
          usersMap,
          forYouList,
          forYouTime,
          telegramId,
          generateInviteLink,
          suggestQueue,
        );
      } else if (userStep === "invite") {
        if (ctx?.message?.text === "بازگشت") {
          existingUser.userStep = "menu";
          usersMap.set(telegramId, {
            time: Date.now(),
            user: existingUser,
          });
          ctx.reply(
            `1. ${"مشاهده پروفایل ها"}\n2. ${"پروفایل من"}\n3. ${"حالت خواب"}\n----------------------------\n4. ${"دوستان خود را دعوت کنید تا لایک های بیشتری دریافت کنید 😎"}`,
            {
              reply_markup: {
                keyboard: [
                  [
                    { text: "1 🚀" },
                    { text: "2" },
                    { text: "3" },
                    { text: "4" },
                    //{ text: "5" },
                  ],
                ],
                resize_keyboard: true,
                one_time_keyboard: false,
                is_persistent: true,
              },
            },
          );
        } else {
          await ctx.reply(
            "دوستان خود را دعوت کنید تا لایک های بیشتری دریافت کنید!\n\nبا دوستان خود یا در شبکه های اجتماعی خود به اشتراک گذاری کنید!\nلینک شخصی شما 👇🏽",
            {
              reply_markup: {
                keyboard: [[{ text: "بازگشت" }]],
                resize_keyboard: true,
                one_time_keyboard: false,
                is_persistent: true,
              },
            },
          );
          const shareText =
            "ربات دوستیابی پونس 🔥 در بله است! یک دوست جدید یا حتی یک عاشق پیدا کنید 👫" +
            "\n👉🏻 " +
            generateInviteLink(telegramId);

          ctx.reply(shareText);
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

            ctx.reply(
              `1. ${"مشاهده پروفایل ها"}\n2. ${"پروفایل من"}\n3. ${"حالت خواب"}\n----------------------------\n4. ${"دوستان خود را دعوت کنید تا لایک های بیشتری دریافت کنید 😎"}`,
              {
                reply_markup: {
                  keyboard: [
                    [
                      { text: "1 🚀" },
                      { text: "2" },
                      { text: "3" },
                      { text: "4" },
                      //{ text: "5" },
                    ],
                  ],
                  resize_keyboard: true,
                  is_persistent: true,
                },
              },
            );
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

            await ctx.reply("✅");
            ctx.reply(
              `1. ${"مشاهده پروفایل ها"}\n2. ${"پروفایل من"}\n3. ${"حالت خواب"}\n----------------------------\n4. ${"دوستان خود را دعوت کنید تا لایک های بیشتری دریافت کنید 😎"}`,
              {
                reply_markup: {
                  keyboard: [
                    [
                      { text: "1 🚀" },
                      { text: "2" },
                      { text: "3" },
                      { text: "4" },
                      //{ text: "5" },
                    ],
                  ],
                  resize_keyboard: true,
                  is_persistent: true,
                },
              },
            );
          } catch (error) {
            console.log({ error });
          }
        } else {
          try {
            ctx.reply(
              `${"حالت خواب"}: ${
                existingUser.sleep ? "فعال" : "غیرفعال"
              }\n\n${"اگر حالت خواب فعال باشد ، لایکی دریافت نمیکنید"}`,
              {
                reply_markup: {
                  keyboard: [
                    [
                      {
                        text: existingUser.sleep ? "غیرفعال" : "فعال",
                      },
                    ],
                    [{ text: "بازگشت" }],
                  ],
                  resize_keyboard: true,
                  one_time_keyboard: false,
                  is_persistent: true,
                },
              },
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

            await ctx.reply(
              `${"افرادی شما را لایک کردند. یه نگاهی بنداز "}\n\n1. ${"نمایش"}\n2. ${"حالت خواب"}`,
              {
                reply_markup: {
                  keyboard: [[{ text: "1 🚀" }, { text: "2" }]],
                  resize_keyboard: true,
                  one_time_keyboard: false,
                  is_persistent: true,
                },
              },
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

            await ctx.reply("✅");
            await ctx.reply(
              `${"افرادی شما را لایک کردند. یه نگاهی بنداز "}\n\n1. ${"نمایش"}\n2. ${"حالت خواب"}`,
              {
                reply_markup: {
                  keyboard: [[{ text: "1 🚀" }, { text: "2" }]],
                  resize_keyboard: true,
                  one_time_keyboard: false,
                  is_persistent: true,
                },
              },
            );
          } catch (error) {
            console.log({ error });
          }
        } else {
          try {
            ctx.reply(
              `${"حالت خواب"}: ${
                existingUser.sleep ? "فعال" : "غیرفعال"
              }\n\n${"اگر حالت خواب فعال باشد ، لایکی دریافت نمیکنید"}`,
              {
                reply_markup: {
                  keyboard: [
                    [
                      {
                        text: existingUser.sleep ? "غیرفعال" : "فعال",
                      },
                    ],
                    [{ text: "بازگشت" }],
                  ],
                  resize_keyboard: true,
                  one_time_keyboard: false,
                  is_persistent: true,
                },
              },
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
              { new: true },
            );

            usersMap.set(telegramId, {
              time: Date.now(),
              user: updatedUser,
            });

            await ctx.reply(`${"لایک ها"} :`, {
              reply_markup: {
                keyboard: [[{ text: "❌" }, { text: "❤️" }]],
                resize_keyboard: true,
                is_persistent: true,
              },
            });

            const getData = await redisClient.getBuffer(`newLikes`);

            if (Buffer.isBuffer(getData)) {
              const userRoot = await protobuf.load(
                "./protoBuf_files/newLike.proto",
              );

              let NewLikeProto = userRoot.lookupType("Users");
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
                const inviteCode_ =
                  userFromRedis.likers[0].inviteCode;

                try {
                  await ctx.replyWithPhoto(
                    {
                      source: fs.createReadStream(photos[0]),
                    },
                    {
                      caption: `${fullName}, ${age}, ${state} ${
                        bio ? "\n" + bio : ""
                      } \n/user_${inviteCode_ || "not_found"}`,
                    },
                  );
                } catch (error) {
                  try {
                    await ctx.reply(
                      `${fullName}, ${age}, ${state} ${
                        bio ? "\n" + bio : ""
                      } \n/user_${inviteCode_ || "not_found"}`,
                    );
                  } catch (error) {
                    console.log(error);
                  }
                }
              }
            } else {
              ctx.reply("شما لایکی ندارید");
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

            ctx.reply(
              `${"حالت خواب"}: ${
                existingUser.sleep ? "فعال" : "غیرفعال"
              }\n\n${"اگر حالت خواب فعال باشد ، لایکی دریافت نمیکنید"}`,
              {
                reply_markup: {
                  keyboard: [
                    [
                      {
                        text: existingUser.sleep ? "غیرفعال" : "فعال",
                      },
                    ],
                    [{ text: "بازگشت" }],
                  ],
                  resize_keyboard: true,
                  one_time_keyboard: false,
                  is_persistent: true,
                },
              },
            );
          } catch (error) {
            console.log(error);
          }
        } else {
          await ctx.reply(
            `${"افرادی شما را لایک کردند. یه نگاهی بنداز "}\n\n1. ${"نمایش"}\n2. ${"حالت خواب"}`,
            {
              reply_markup: {
                keyboard: [[{ text: "1 🚀" }, { text: "2" }]],
                resize_keyboard: true,
                one_time_keyboard: false,
                is_persistent: true,
              },
            },
          );
        }
      } else if (userStep === "notifications") {
        if (ctx?.message?.text === "❤️") {
          try {
            if (!existingUser.matches) existingUser.matches = [];
            // if (
            //   existingUser.subscription?.numOfDays > 0 &&
            //   existingUser.subscription?.time +
            //     existingUser.subscription?.numOfDays * 86400000 >
            //     Date.now()
            // ) {
            // } else if (existingUser.matches.length > 0) {
            //   await ctx.reply(
            //     `شما و این کاربر با همدیگر مطابقت داده شده‌اید! 🎉\n\n⚠️ برای دریافت پروفایل کاربر باید اشتراک ویژه تهیه کنید`,
            //   );
            //   await ctx.replyWithPhoto(
            //     "https://pouns-storage.storage.c2.liara.space/Group%20450-min.jpg",
            //     {
            //       reply_markup: {
            //         inline_keyboard: [
            //           [
            //             {
            //               text: "1 ماهه  -  99 هزار تومان",
            //               callback_data: "plan_1month",
            //             },
            //           ],
            //           [
            //             {
            //               text: "3 ماهه  -  210 هزار تومان 🔥",
            //               callback_data: "plan_3month",
            //             },
            //           ],
            //           [
            //             {
            //               text: "6 ماهه  -  480 هزار تومان",
            //               callback_data: "plan_6month",
            //             },
            //           ],
            //         ],
            //       },
            //     },
            //   );
            //   return;
            // }
            // const updatedUser = await User.findOneAndUpdate(
            //   { telegramId },
            //   { userStep: "notifications" },
            //   { new: true },
            // );

            const getData = await redisClient.getBuffer(`newLikes`);

            // console.log("notif step 1 ---", { getData });
            if (Buffer.isBuffer(getData)) {
              const userRoot = await protobuf.load(
                "./protoBuf_files/newLike.proto",
              );

              let NewLikeProto = userRoot.lookupType("Users");
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
                const photos = userFromRedis.likers[0].profileImages;
                const fullName = userFromRedis.likers[0].fullName;
                const likerUserName =
                  userFromRedis.likers[0].userName;
                const age = userFromRedis.likers[0].age;
                const state = userFromRedis.likers[0].state;
                const country = userFromRedis.likers[0].country;
                const flag = userFromRedis.likers[0].flag;
                const bio = userFromRedis.likers[0].bio;

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

                console.log("notif step 3 ---");

                // if (likerUserName) {
                await ctx.reply(
                  ` ${"شما و"} ${fullName} ${"با همدیگر مطابقت داده شده‌اید!"} 🎉\n\n${"از طریق دکمه زیر می‌توانید با هم چت کنید:"}`,
                  {
                    reply_markup: {
                      inline_keyboard: [
                        [
                          {
                            text: "شروع چت 💬",
                            url: `https://ble.ir/${likerUserName}?text=${"سلام"} ${fullName} ${"من از پونس هستم"}`,
                          },
                        ],
                      ],
                    },
                  },
                );
                // } else {
                //   try {
                //     await ctx.reply(
                //       ` ${"شما و"} ${fullName} ${"با همدیگر مطابقت داده شده‌اید!"} 🎉\n\n${"از طریق دکمه زیر می‌توانید با هم چت کنید:"}`,
                //       {
                //         reply_markup: {
                //           inline_keyboard: [
                //             [
                //               {
                //                 text: "شروع چت 💬",
                //                 url: `tg://user?id=${likerTelegramId}&text=${"سلام"} ${fullName} ${"من از پونس هستم"}`,
                //               },
                //             ],
                //           ],
                //         },
                //       },
                //     );
                //   } catch (error) {
                //     if (usersMap.get(likerTelegramId)) {
                //       usersMap.get(
                //         likerTelegramId,
                //       ).user.unavailablePv = true;
                //       usersMap.set(likerTelegramId, {
                //         time: Date.now(),
                //         user: usersMap.get(likerTelegramId).user,
                //       });
                //     } else {
                //       const updatedUser = await User.findOneAndUpdate(
                //         { telegramId: likerTelegramId },
                //         { unavailablePv: true },
                //         { new: true },
                //       );
                //       usersMap.set(likerTelegramId, {
                //         time: Date.now(),
                //         user: updatedUser,
                //       });
                //     }
                //   }
                // }

                // if (userName) {
                await bot.telegram.sendMessage(
                  +likerTelegramId,
                  ` ${"شما و"} ${existingUser.fullName} ${"با همدیگر مطابقت داده شده‌اید!"} 🎉\n\n${"از طریق دکمه زیر می‌توانید با هم چت کنید:"}`,
                  {
                    reply_markup: {
                      inline_keyboard: [
                        [
                          {
                            text: "شروع چت 💬",
                            url: `https://ble.ir/${userName}?text=${"سلام"} ${existingUser.fullName} ${"من از پونس هستم"}`,
                          },
                        ],
                      ],
                    },
                  },
                );
                // } else {
                //   try {
                //     await bot.telegram.sendMessage(
                //       +likerTelegramId,
                //       `${"شما و"} ${existingUser.fullName} ${"با همدیگر مطابقت داده شده‌اید!"} 🎉\n\n${"از طریق دکمه زیر می‌توانید با هم چت کنید:"}`,
                //       {
                //         reply_markup: {
                //           inline_keyboard: [
                //             [
                //               {
                //                 text: "شروع چت 💬",
                //                 url: `tg://user?id=${telegramId}&text=${"سلام"} ${fullName} ${"من از پونس هستم"}`,
                //               },
                //             ],
                //           ],
                //         },
                //       },
                //     );
                //   } catch (error) {
                //     existingUser.unavailablePv = true;
                //     usersMap.set(telegramId, {
                //       time: Date.now(),
                //       user: existingUser,
                //     });
                //   }
                // }

                console.log("matches step -------------");

                // save in matches in db -----------------------------
                // پیدا کردن ایندکس کاربر موجود با telegramId
                const existingMatchIndex =
                  existingUser.matches.findIndex(
                    (match) => match.telegramId === +likerTelegramId,
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
                    age,
                    country,
                    state,
                    flag,
                    bio,
                    profileImages: photos,
                  });
                }

                usersMap.set(telegramId, {
                  time: Date.now(),
                  user: existingUser,
                });
                // await existingUser.save();

                const findContact = await User.findOne({
                  telegramId: +likerTelegramId,
                });
                if (findContact) {
                  // پیدا کردن ایندکس کاربر موجود با telegramId
                  const existingMatchIndex =
                    findContact.matches.findIndex(
                      (match) => match.telegramId === +telegramId,
                    );

                  if (existingMatchIndex !== -1) {
                    // اگر وجود داشت، به ایندکس 0 منتقل شود
                    const existingMatch = findContact.matches.splice(
                      existingMatchIndex,
                      1,
                    )[0];
                    findContact.matches.unshift(existingMatch);
                  } else {
                    // اگر وجود نداشت، اضافه شود
                    findContact.matches.unshift({
                      telegramId: +telegramId,
                      fullName: existingUser.fullName,
                      age: existingUser.age,
                      country: existingUser.country,
                      state: existingUser.state,
                      flag: existingUser.flag,
                      bio: existingUser.moreInformation.bio,
                      profileImages: existingUser.profileImages,
                    });
                  }

                  await findContact.save();
                }

                usersMap.set(+likerTelegramId, {
                  time: Date.now(),
                  user: findContact,
                });
                // end save in matches in db -------------------------

                // delete from list ----------------------------------
                const list = userFromRedis.likers;
                if (Array.isArray(list)) {
                  list.shift(); // فقط آیتم اول حذف می‌شود
                  // forYouList.set(telegramId, list); // دوباره در map قرار می‌دهیم (اختیاری)

                  const updatedUsersArray = usersArrayFromRedis.map(
                    (user) => {
                      if (+user.telegramId === +telegramId) {
                        return { ...user, likers: list };
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

                  try {
                    await ctx.replyWithPhoto(
                      {
                        source: fs.createReadStream(photos[0]),
                      },
                      {
                        caption: `${fullName}, ${age}, ${state} ${
                          bio ? "\n" + bio : ""
                        } \n/user_${inviteCode_ || "not_found"}`,
                      },
                    );
                  } catch (error) {
                    try {
                      await ctx.reply(
                        `${fullName}, ${age}, ${state} ${
                          bio ? "\n" + bio : ""
                        } \n/user_${inviteCode_ || "not_found"}`,
                      );
                    } catch (error) {
                      console.log(error);
                    }
                  }
                } else {
                  ctx.reply("پایان لایک ها");
                  existingUser.userStep = "menu";

                  usersMap.set(telegramId, {
                    time: Date.now(),
                    user: existingUser,
                  });
                  // await existingUser.save();

                  ctx.reply(
                    `1. ${"مشاهده پروفایل ها"}\n2. ${"پروفایل من"}\n3. ${"حالت خواب"}\n----------------------------\n4. ${"دوستان خود را دعوت کنید تا لایک های بیشتری دریافت کنید 😎"}`,
                    {
                      reply_markup: {
                        keyboard: [
                          [
                            { text: "1 🚀" },
                            { text: "2" },
                            { text: "3" },
                            { text: "4" },
                            //{ text: "5" },
                          ],
                        ],
                        resize_keyboard: true,
                        is_persistent: true,
                      },
                    },
                  );
                }
                // end show nextUser ---------------------------------

                // await ctx.reply(
                //   `<a href="https://ble.ir/${"Abolfazl021aaaa"}?text=سلام ${fullName}، از طریق تلگرام با شما آشنا شدم 😊">💬 شروع چت</a>`,
                //   { parse_mode: "HTML" },
                // );
              } else {
                console.log("notif step 3-1 ---");
                ctx.reply("پایان لایک ها");
                existingUser.userStep = "menu";
                usersMap.set(telegramId, {
                  time: Date.now(),
                  user: existingUser,
                });
                // await existingUser.save();

                ctx.reply(
                  `1. ${"مشاهده پروفایل ها"}\n2. ${"پروفایل من"}\n3. ${"حالت خواب"}\n----------------------------\n4. ${"دوستان خود را دعوت کنید تا لایک های بیشتری دریافت کنید 😎"}`,
                  {
                    reply_markup: {
                      keyboard: [
                        [
                          { text: "1 🚀" },
                          { text: "2" },
                          { text: "3" },
                          { text: "4" },
                          //{ text: "5" },
                        ],
                      ],
                      resize_keyboard: true,
                      is_persistent: true,
                    },
                  },
                );
                return;
              }
            } else {
              ctx.reply("شما لایکی ندارید");
            }
          } catch (error) {
            console.log(error);
          }
        } else if (ctx?.message?.text === "❌") {
          try {
            const getData = await redisClient.getBuffer(`newLikes`);

            console.log("notif step 1 ---", { getData });
            if (Buffer.isBuffer(getData)) {
              const userRoot = await protobuf.load(
                "./protoBuf_files/newLike.proto",
              );

              let NewLikeProto = userRoot.lookupType("Users");
              const decodedMessage = NewLikeProto.decode(getData);
              let usersArrayFromRedis = decodedMessage.users || [];
              console.log({ usersArrayFromRedis });
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
                if (Array.isArray(list)) {
                  list.shift(); // فقط آیتم اول حذف می‌شود
                  // forYouList.set(telegramId, list); // دوباره در map قرار می‌دهیم (اختیاری)

                  const updatedUsersArray = usersArrayFromRedis.map(
                    (user) => {
                      if (+user.telegramId === +telegramId) {
                        return { ...user, likers: list };
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

                  try {
                    await ctx.replyWithPhoto(
                      {
                        source: fs.createReadStream(photos[0]),
                      },
                      {
                        caption: `${fullName}, ${age}, ${state} ${
                          bio ? "\n" + bio : ""
                        } \n/user_${inviteCode_ || "not_found"}`,
                      },
                    );
                  } catch (error) {
                    try {
                      await ctx.reply(
                        `${fullName}, ${age}, ${state} ${
                          bio ? "\n" + bio : ""
                        } \n/user_${inviteCode_ || "not_found"}`,
                      );
                    } catch (error) {
                      console.log(error);
                    }
                  }
                } else {
                  ctx.reply("پایان لایک ها");
                  existingUser.userStep = "menu";

                  usersMap.set(telegramId, {
                    time: Date.now(),
                    user: existingUser,
                  });
                  // await existingUser.save();

                  ctx.reply(
                    `1. ${"مشاهده پروفایل ها"}\n2. ${"پروفایل من"}\n3. ${"حالت خواب"}\n----------------------------\n4. ${"دوستان خود را دعوت کنید تا لایک های بیشتری دریافت کنید 😎"}`,
                    {
                      reply_markup: {
                        keyboard: [
                          [
                            { text: "1 🚀" },
                            { text: "2" },
                            { text: "3" },
                            { text: "4" },
                            //{ text: "5" },
                          ],
                        ],
                        resize_keyboard: true,
                        is_persistent: true,
                      },
                    },
                  );
                }
                // end show nextUser ---------------------------------

                // await ctx.reply(
                //   `<a href="https://ble.ir/${"Abolfazl021aaaa"}?text=سلام ${fullName}، از طریق تلگرام با شما آشنا شدم 😊">💬 شروع چت</a>`,
                //   { parse_mode: "HTML" },
                // );
              } else {
                console.log("notif step 3-1 ---");
                ctx.reply("پایان لایک ها");
                existingUser.userStep = "menu";
                usersMap.set(telegramId, {
                  time: Date.now(),
                  user: existingUser,
                });
                // await existingUser.save();

                ctx.reply(
                  `1. ${"مشاهده پروفایل ها"}\n2. ${"پروفایل من"}\n3. ${"حالت خواب"}\n----------------------------\n4. ${"دوستان خود را دعوت کنید تا لایک های بیشتری دریافت کنید 😎"}`,
                  {
                    reply_markup: {
                      keyboard: [
                        [
                          { text: "1 🚀" },
                          { text: "2" },
                          { text: "3" },
                          { text: "4" },
                          //{ text: "5" },
                        ],
                      ],
                      resize_keyboard: true,
                      is_persistent: true,
                    },
                  },
                );
                return;
              }
            } else {
              ctx.reply("شما لایکی ندارید");
            }
          } catch (error) {
            console.log(error);
          }
        } else {
          await ctx.reply(`${"لایک ها"} :`, {
            reply_markup: {
              keyboard: [[{ text: "❌" }, { text: "❤️" }]],
              resize_keyboard: true,
              is_persistent: true,
            },
          });
        }
      } else if (userStep === "directMessage") {
        if (ctx?.message?.text) {
          try {
            const list = forYouList.get(telegramId);
            if (Array.isArray(list)) {
              list.shift(); // فقط آیتم اول حذف می‌شود
              forYouList.set(telegramId, list); // دوباره در map قرار می‌دهیم (اختیاری)
            }

            const {
              fullName,
              age,
              state,
              bio,
              profileImages,
              inviteCode: inviteCode_from_forYouList,
            } = forYouList.get(telegramId)[0];
            userTelId = forYouList.get(telegramId)[0].telegramId;

            const photos = profileImages;

            try {
              await bot.telegram.sendMessage(
                +existingUser.lastViewed,
                `${"شما یک پیام جدید از"} ${
                  existingUser.fullName
                } :\n\n${ctx?.message?.text}\n/user_${
                  generateInviteCode(telegramId) || "not_found"
                }`,
                {
                  reply_markup: {
                    inline_keyboard: [
                      [
                        {
                          text: `answer`,
                          callback_data: `answer_message_${telegramId}`,
                        },
                      ],
                    ],
                  },
                },
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
            await ctx.reply("پیام شما ارسال شد ✅", {
              reply_markup: {
                keyboard: [
                  [
                    { text: "💌" },
                    { text: "❌" },
                    { text: "❤️" },
                    { text: "☰" },
                  ],
                ],
                resize_keyboard: true,
                is_persistent: true, // این خط را اضافه کنید
              },
            });

            try {
              await ctx.replyWithPhoto(
                {
                  source: fs.createReadStream(photos[0]),
                },
                {
                  caption: `${fullName}, ${age}, ${state} ${
                    bio ? "\n" + bio : ""
                  } \n/user_${inviteCode_from_forYouList || "not_found"}`,
                },
              );
            } catch (error) {
              try {
                await ctx.reply(
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
          ctx.reply("لطفا فقط پیام متنی ارسال کنید.");
        }
      } else if (userStep === "answer") {
        if (ctx?.message?.text === "بازگشت") {
          existingUser.userStep = "menu";
          usersMap.set(telegramId, {
            time: Date.now(),
            user: existingUser,
          });
          ctx.reply(
            `1. ${"مشاهده پروفایل ها"}\n2. ${"پروفایل من"}\n3. ${"حالت خواب"}\n----------------------------\n4. ${"دوستان خود را دعوت کنید تا لایک های بیشتری دریافت کنید 😎"}`,
            {
              reply_markup: {
                keyboard: [
                  [
                    { text: "1 🚀" },
                    { text: "2" },
                    { text: "3" },
                    { text: "4" },
                  ],
                ],
                resize_keyboard: true,
                is_persistent: true,
              },
            },
          );
          return;
        } else if (ctx?.message?.text) {
          if (!existingUser.lastAnsweredMessage) {
            ctx.reply(
              "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)",
            );
            return;
          }
          console.log({
            lastAnsweredMessage: existingUser.lastAnsweredMessage,
          });
          try {
            const {
              fullName,
              age,
              state,
              flag,
              bio,
              profileImages,
              inviteCode: inviteCode_from_forYouList,
            } = forYouList.get(telegramId)[0];
            userTelId = forYouList.get(telegramId)[0].telegramId;

            const photos = profileImages;

            try {
              await bot.telegram.sendMessage(
                +existingUser.lastAnsweredMessage,
                `${"شما یک پیام جدید از"} ${
                  existingUser.fullName
                } :\n\n${ctx?.message?.text}\n/user_${
                  generateInviteCode(telegramId) || "not_found"
                }`,
                {
                  reply_markup: {
                    inline_keyboard: [
                      [
                        {
                          text: `answer`,
                          callback_data: `answer_message_${telegramId}`,
                        },
                      ],
                    ],
                  },
                },
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
            await ctx.reply("پیام شما ارسال شد ✅", {
              reply_markup: {
                keyboard: [
                  [
                    { text: "💌" },
                    { text: "❌" },
                    { text: "❤️" },
                    { text: "☰" },
                  ],
                ],
                resize_keyboard: true,
                is_persistent: true, // این خط را اضافه کنید
              },
            });

            try {
              await ctx.replyWithPhoto(
                {
                  source: fs.createReadStream(photos[0]),
                },
                {
                  caption: `${fullName}, ${age}, ${state} ${
                    bio ? "\n" + bio : ""
                  } \n/user_${inviteCode_from_forYouList || "not_found"}`,
                },
              );
            } catch (error) {
              try {
                await ctx.reply(
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
          ctx.reply("لطفا فقط پیام متنی ارسال کنید.");
        }
      } else if (userStep === "userProfile") {
        if (ctx?.message?.text === "گزارش") {
          ctx.reply(
            `${"چرا میخوای این کاربر را گزارش کنی؟"} /user_${existingUser?.inviteCode}`,
            {
              reply_markup: {
                inline_keyboard: [
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
              },
            },
          );
        } else if (ctx?.message?.text === "بازگشت به منوی اصلی") {
          existingUser.userStep = "menu";
          usersMap.set(telegramId, {
            time: Date.now(),
            user: existingUser,
          });
          ctx.reply(
            `1. ${"مشاهده پروفایل ها"}\n2. ${"پروفایل من"}\n3. ${"حالت خواب"}\n----------------------------\n4. ${"دوستان خود را دعوت کنید تا لایک های بیشتری دریافت کنید 😎"}`,
            {
              reply_markup: {
                keyboard: [
                  [
                    { text: "1 🚀" },
                    { text: "2" },
                    { text: "3" },
                    { text: "4" },
                  ],
                ],
                resize_keyboard: true,
                is_persistent: true,
              },
            },
          );
        } else {
          existingUser.userStep = "menu";
          usersMap.set(telegramId, {
            time: Date.now(),
            user: existingUser,
          });
          ctx.reply(
            `1. ${"مشاهده پروفایل ها"}\n2. ${"پروفایل من"}\n3. ${"حالت خواب"}\n----------------------------\n4. ${"دوستان خود را دعوت کنید تا لایک های بیشتری دریافت کنید 😎"}`,
            {
              reply_markup: {
                keyboard: [
                  [
                    { text: "1 🚀" },
                    { text: "2" },
                    { text: "3" },
                    { text: "4" },
                  ],
                ],
                resize_keyboard: true,
                one_time_keyboard: false,
                is_persistent: true,
              },
            },
          );
        }
      }
    } else {
      if (inviteCode) {
        const inviteByUser = await User.findOne({
          inviteCode: inviteCode,
        });
        inviteByUser.giftLikeCount += 100;
        await inviteByUser.save();
        await bot.telegram.sendMessage(
          +inviteByUser.telegramId,
          "ممون از دعوت شما . 100 لایک هدیه دریافت کردید.",
        );

        if (usersMap.get(+inviteByUser.telegramId)) {
          usersMap.get(+inviteByUser.telegramId).user.giftLikeCount +=
            100;
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
        ages,
        chunkArray,
        telegramId,
        telegramName,
        saveduser,
        redisClient,
        forYouList,
        forYouTime,
        suggestQueue,
        foryouQueue,
      );
    }
  } catch (error) {
    console.log(error);
  }
};

bot.start(async (ctx) => {
  console.log("/start");
  await processStatement(ctx);
});

bot.action(/answer_message_(.+)/, async (ctx) => {
  const telegramId = ctx.match[1]; // این یک string است

  if (usersMap.get(ctx.from.id)) {
    const existingUser = usersMap.get(ctx.from.id).user;
    existingUser.userStep = "answer";
    existingUser.lastAnsweredMessage = +telegramId;
    usersMap.set(ctx.from.id, {
      user: existingUser,
      time: Date.now(),
    });
  } else {
    const existingUser = await User.findOne({
      telegramId: ctx.from.id,
    });
    existingUser.userStep = "answer";
    existingUser.lastAnsweredMessage = +telegramId;
    usersMap.set(ctx.from.id, {
      user: existingUser,
      time: Date.now(),
    });
  }

  await ctx.answerCbQuery();
  await ctx.reply("پیام خود را ارسال کنید 🧐👇🏽", {
    reply_markup: {
      keyboard: [[{ text: "بازگشت" }]],
      resize_keyboard: true,
      is_persistent: true,
    },
  });
});

bot.hears(/\/user_(.+)/, async (ctx) => {
  const userId = ctx.match[1]; // مقدار بعد از user_
  const telegramId___ = ctx.from.id;

  if (usersMap.get(ctx.from.id)) {
    const existingUser = usersMap.get(ctx.from.id).user;
  } else {
    const existingUser = await User.findOne({
      telegramId: ctx.from.id,
    });
  }

  if (!userId || userId === "not_found") {
    ctx.reply("کد معرف یافت نشد.");
    return;
  }

  try {
    const {
      fullName,
      age,
      state,
      flag,
      profileImages,
      moreInformation,
      telegramId,
      inviteCode,
    } = await User.findOne({ inviteCode: userId });

    if (usersMap.get(telegramId___)) {
      const existingUser = usersMap.get(telegramId___).user;
      existingUser.userProfile = {
        telegramId,
        fullName,
        age,
        state,
        flag,
        profileImages,
        inviteCode,
        bio: moreInformation?.bio,
      };
      existingUser.userStep = "userProfile";
      usersMap.set(telegramId___, {
        user: existingUser,
        time: Date.now(),
      });
    } else {
      const existingUser = await User.findOneAndUpdate(
        { telegramId: telegramId___ },
        {
          userStep: "userProfile",
          userProfile: {
            telegramId,
            fullName,
            age,
            state,
            profileImages,
            bio: moreInformation?.bio,
            inviteCode,
          },
        },
        { new: true },
      );
      usersMap.set(telegramId___, {
        user: existingUser,
        time: Date.now(),
      });
    }

    console.log({ profileImages });
    const photo = profileImages[0];
    const bio = moreInformation?.bio;

    try {
      await ctx.replyWithPhoto(
        {
          source: fs.createReadStream(photo),
        },
        {
          caption: `${fullName}, ${age}, ${state} ${
            bio ? "\n" + bio : ""
          }\n/user_${userId || "not_found"}`,
          reply_markup: {
            keyboard: [
              [
                {
                  text: "گزارش",
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
        },
      );
    } catch (error) {
      try {
        await ctx.reply(
          `${fullName}, ${age}, ${state} ${
            bio ? "\n" + bio : ""
          }\n/user_${userId || "not_found"}`,
          {
            reply_markup: {
              keyboard: [
                [
                  {
                    text: "گزارش",
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
          },
        );
      } catch (error) {
        console.log(error);
      }
    }
  } catch (error) {
    console.log(error);
  }
});

bot.on("message", async (ctx) => {
  await processStatement(ctx);
});

bot.action("done_start", async (ctx) => {
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

const reportAction = async (reportType, telegramId___, ctx) => {
  try {
    let existingUser;

    if (usersMap.get(telegramId___)) {
      existingUser = usersMap.get(telegramId___).user;
    } else {
      existingUser = await User.findOne({
        telegramId: telegramId___,
      });
    }

    if (!existingUser.userProfile.telegramId) {
      await ctx.reply("کاربر یافت نشد.");
      return;
    }

    const reportedId =
      existingUser.userProfile.telegramId &&
      +existingUser.userProfile.telegramId; // مقدار بعد از report_

    let report = await Report.findOne({ telegramId: reportedId });
    if (!report) {
      report = await Report.create({ telegramId: reportedId });
    }
    if (
      report.reports.find(
        (report) => report.reportedTelegramId === telegramId___,
      )
    ) {
      await ctx.reply("شما قبلا برای این کاربر گزارش داده اید.");
      return;
    }
    report.reports.push({
      type: reportType,
      reportedTelegramId: telegramId___,
    });
    await report.save();
    await ctx.reply("گزارش شما ثبت شد ✅");
    existingUser.userStep = "menu";
    usersMap.set(telegramId___, {
      user: existingUser,
      time: Date.now(),
    });
    ctx.reply(
      `1. ${"مشاهده پروفایل ها"}\n2. ${"پروفایل من"}\n3. ${"حالت خواب"}\n----------------------------\n4. ${"دوستان خود را دعوت کنید تا لایک های بیشتری دریافت کنید 😎"}`,
      {
        reply_markup: {
          keyboard: [
            [
              { text: "1 🚀" },
              { text: "2" },
              { text: "3" },
              { text: "4" },
            ],
          ],
          resize_keyboard: true,
          is_persistent: true,
          one_time_keyboard: false,
        },
      },
    );
  } catch (error) {
    console.log(error);
  }
};

bot.action("report_advertisement", async (ctx) => {
  await reportAction("report_advertisement", ctx.from.id, ctx);
});
bot.action("report_inappropriate_content", async (ctx) => {
  await reportAction(
    "report_inappropriate_content",
    ctx.from.id,
    ctx,
  );
});
bot.action("report_harassment", async (ctx) => {
  await reportAction("report_harassment", ctx.from.id, ctx);
});
bot.action("report_phone_number", async (ctx) => {
  await reportAction("report_phone_number", ctx.from.id, ctx);
});
bot.action("report_inappropriate_profile", async (ctx) => {
  await reportAction(
    "report_inappropriate_profile",
    ctx.from.id,
    ctx,
  );
});
bot.action("report_incorrect_gender", async (ctx) => {
  await reportAction("report_incorrect_gender", ctx.from.id, ctx);
});
bot.action("report_other", async (ctx) => {
  await reportAction("report_other", ctx.from.id, ctx);
});

bot.launch();

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
