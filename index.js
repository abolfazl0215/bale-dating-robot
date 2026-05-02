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
// const fakeUsers = require("./utils/fakeUsers.js");

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

const server = http.createServer(app, {});

mongoose
  .connect(
    "mongodb://root:EOYcwZU9ulmklCPQ0TaNIqKw@etna.liara.cloud:33903/my-app?authSource=admin",
  )
  .then(async () => {
    console.log("Connected to MongoDB");
    // Fix email index: drop old non-sparse index and let Mongoose recreate it as sparse
    // try {
    //   const userCollection =
    //     mongoose.connection.db.collection("users");
    //   const indexes = await userCollection.indexes();
    //   const emailIndex = indexes.find(
    //     (idx) => idx.key && idx.key.email === 1,
    //   );
    //   if (emailIndex && !emailIndex.sparse) {
    //     await userCollection.dropIndex("email_1");
    //     console.log("Dropped old non-sparse email index");
    //     // Mongoose will automatically create the sparse index based on schema
    //     await User.createIndexes();
    //     console.log("Recreated email index as sparse");
    //   }
    // } catch (err) {
    //   console.error("Error fixing email index:", err);
    // }
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
}, 3600000);
// check for new likes every 1 houre and send notification >>>

const ages = Array.from({ length: 63 }, (_, i) => 18 + i); // [18, 19, ..., 70]
const langsTextShow = languages.map((item) => item.text);
const countriesTextShow = countries.map(
  (item) => item.emojiFlag + " " + item.nativeName,
);

const lastTimeAddProfileToList = new Map();
// const forYouList = new Map();

const forYouTime = new Map();

// check and cleanup old users from map and save to mingoDB every 30 minutes <<<
async function startCleanup() {
  await cleanupOldUsersFromMapAndSaveToDB();
  setTimeout(startCleanup, 30 * 60 * 1000); // 30 دقیقه
}
setTimeout(() => {
  startCleanup();
}, 10000);
// check and cleanup old users from map and save to mingoDB every 30 minutes >>>

const processStatement = async (ctx) => {
  try {
    if (ctx.message.successful_payment) {
      console.log("پرداخت موفق:", ctx.message.successful_payment);
      await ctx.reply("✅ پرداخت موفق! اشتراک شما فعال شد.");
      return;
    }

    const inviteLink = `https://t.me/pounes_bot?start=${generateInviteCode(
      ctx.from.id,
    )}`;

    const telegramId = ctx.from.id;
    const telegramName = ctx.from.first_name;
    const userName = ctx.from.username;
    const isBot = ctx.from.is_bot;
    const inviteCode = ctx.startPayload;

    console.log({ telegramId, telegramName, userName, isBot });

    if (isBot || !telegramId) return;

    // set existingUser <<<
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
    // set existingUser >>>

    // check if user is banned cant use bot <<<
    if (existingUser?.ban) {
      await ctx.reply("شما مسدود شده اید");
      return;
    }
    // check if user is banned cant use bot >>>

    // if user is unavailable private chat ask to active it <<<
    // if (existingUser?.unavailablePv) {
    //   let userLanguage = existingUser?.language || "en";
    //   let languageText = texts.find(
    //     (text) => text.language === userLanguage,
    //   );
    //   await ctx.reply(
    //     `${languageText.unavailableProfile}:\n\n1. ${languageText.activePvButton}\n2. ${languageText.haveUsername}`,
    //     {
    //       reply_markup: {
    //         inline_keyboard: [
    //           [
    //             {
    //               text: languageText.activePv,
    //               callback_data: "active_pv",
    //             },
    //           ],
    //         ],
    //       },
    //     },
    //   );
    //   return;
    // }
    // if user is unavailable private chat ask to active it >>>

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

      try {
        await bot.telegram.sendMessage(
          775377257,
          `شما و  با همدیگر مطابقت داده شده‌اید! 🎉\n\nاز طریق دکمه زیر می‌توانید با هم چت کنید:`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "💬 شروع چت",
                    url: `tg://user?id=${telegramId}&text=سلام ، از طریق تلگرام با شما آشنا شدم 😊`,
                  },
                ],
              ],
            },
          },
        );
      } catch (error) {
        existingUser.unAvailablePv = true;
        usersMap.set(telegramId, {
          time: getNowTime(),
          user: existingUser,
        });
        await User.findOneAndUpdate(
          { telegramId },
          { unavailablePv: true },
          { new: true },
        );
      }
    }
    // if user changed userName update it in database >>>

    let userLanguage = existingUser?.language || "en";
    let languageText = texts.find(
      (text) => text.language === userLanguage,
    );

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
          langsTextShow,
          ages,
          countriesTextShow,
          texts,
          chunkArray,
          telegramId,
          languages,
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
          languageText,
          ages,
          langsTextShow,
        );
      } else if (userStep === "editProfile") {
        editProfileInBot(
          ctx,
          chunkArray,
          languageText,
          ages,
          countriesTextShow,
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
          languageText,
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
          languageText,
        );

        if (ctx?.message?.text === "☰") {
          await showMainMenu(
            ctx,
            telegramId,
            existingUser,
            usersMap,
            languageText,
          );
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
            await ctx.reply(languageText.firstLikeText);
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
          await ctx.replyWithMediaGroup(
            photos.map((photo, index) => ({
              type: "photo",
              media: photo,
              caption:
                index === 0
                  ? `${fullName}, ${age}, ${flag + " " + state} ${
                      bio ? "\n" + bio : ""
                    }\n/user_${
                      inviteCode_from_forYouList || "not_found"
                    }`
                  : undefined,
            })),
          );
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
            await ctx.reply(languageText.firstLikeText);
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
          await ctx.replyWithMediaGroup(
            photos.map((photo, index) => ({
              type: "photo",
              media: photo,
              caption:
                index === 0
                  ? `${fullName}, ${age}, ${flag + " " + state} ${
                      bio ? "\n" + bio : ""
                    }\n/user_${
                      inviteCode_from_forYouList || "not_found"
                    }`
                  : undefined,
            })),
          );
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
          ctx.reply(languageText.directMessageText);
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
        if (ctx?.message?.text === "1 🚀") {
          try {
            existingUser.userStep = "search";
            usersMap.set(telegramId, {
              time: Date.now(),
              user: existingUser,
            });
            if (
              forYouList.get(telegramId) &&
              Array.isArray(forYouList.get(telegramId)) &&
              forYouList.get(telegramId).length > 10 &&
              forYouTime.get(telegramId) &&
              forYouTime.get(telegramId) + 600000 > Date.now()
            ) {
              await ctx.reply("🔎", {
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
                  one_time_keyboard: false,
                  is_persistent: true, // این خط را اضافه کنید
                },
              });

              const {
                fullName,
                age,
                state,
                flag,
                bio,
                profileImages,
                inviteCode: inviteCode_from_forYouList,
              } = forYouList.get(telegramId)[0];

              const photos = profileImages;
              // const photos = existingUser.profileImages || [];
              await ctx.replyWithMediaGroup(
                photos.map((photo, index) => ({
                  type: "photo",
                  media: photo,
                  caption:
                    index === 0
                      ? `${fullName}, ${age}, ${flag + " " + state} ${
                          bio ? "\n" + bio : ""
                        } \n/user_${
                          inviteCode_from_forYouList || "not_found"
                        }`
                      : undefined,
                })),
              );
              existingUser.lastViewed =
                +forYouList.get(telegramId)[0].telegramId; // نیاز به ذخیره کردنش نیست
              usersMap.set(telegramId, {
                time: Date.now(),
                user: existingUser,
              });
            } else {
              forYouTime.set(telegramId, Date.now());
              // add to search queue
              suggestQueue.add({
                telegramId,
                user: existingUser,
              });

              // setTimeout(async () => {
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

                await ctx.reply("🔎", {
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
                const photos = profileImages;
                // const photos = existingUser.profileImages || [];
                await ctx.replyWithMediaGroup(
                  photos.map((photo, index) => ({
                    type: "photo",
                    media: photo,
                    caption:
                      index === 0
                        ? `${fullName}, ${age}, ${
                            flag + " " + state
                          } ${bio ? "\n" + bio : ""}\n/user_${
                            inviteCode_from_forYouList || "not_found"
                          }`
                        : undefined,
                  })),
                );
                existingUser.lastViewed =
                  +forYouList.get(telegramId)[0].telegramId; // نیاز به ذخیره کردنش نیست
                usersMap.set(telegramId, {
                  time: Date.now(),
                  user: existingUser,
                });
              } catch (error) {
                console.log({ error });
              }
              // }, 3000);
            }
          } catch (error) {
            console.log({ error });
          }
        } else if (ctx?.message?.text === "2") {
          try {
            const photos = existingUser.profileImages;
            const fullName = existingUser.fullName;
            const age = existingUser.age;
            const state = existingUser.state;
            const bio = existingUser.moreInformation.bio;
            const inviteCode = existingUser.inviteCode;

            await ctx.replyWithPhoto(
              {
                source: fs.createReadStream(photos[0]),
              },
              {
                caption: `${fullName}, ${age}, ${state} ${
                  bio ? "\n" + bio : ""
                } \n/user_${inviteCode || "not_found"}`,
              },
            );

            // await ctx.replyWithMediaGroup(
            //   photos.map((photo, index) => ({
            //     type: "photo",
            //     media: photo,
            //     caption:
            //       index === 0
            //         ? `${fullName}, ${age}, ${flag + " " + state} ${
            //             bio ? "\n" + bio : ""
            //           } \n/user_${inviteCode || "not_found"}`
            //         : undefined,
            //   })),
            // );

            await User.updateOne(
              { telegramId },
              { userStep: "editProfileMenu" },
            );

            existingUser.userStep = "editProfileMenu";

            usersMap.set(telegramId, {
              time: Date.now(),
              user: existingUser,
            });

            ctx.reply(
              `1. ${languageText.viewProfiles} \n2. ${languageText.editMyProfile} \n3. ${languageText.changeMyPhoto} \n4. ${languageText.changeLanguage}`,
              {
                reply_markup: {
                  keyboard: [
                    [
                      { text: "1🚀" },
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
          } catch (error) {
            console.log({ error });
          }
        } else if (ctx?.message?.text === "3") {
          try {
            existingUser.userStep = "sleep";
            // await existingUser.save();
            usersMap.set(telegramId, {
              time: Date.now(),
              user: existingUser,
            });

            ctx.reply(
              `${languageText.sleepMode}: ${
                existingUser.sleep
                  ? languageText.active
                  : languageText.inactive
              }\n\n${languageText.sleepDetail}`,
              {
                reply_markup: {
                  keyboard: [
                    [
                      {
                        text: existingUser.sleep
                          ? languageText.inactive
                          : languageText.active,
                      },
                    ],
                    [{ text: languageText.goBack }],
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
        } else if (ctx?.message?.text === "4") {
          existingUser.userStep = "invite";
          usersMap.set(telegramId, {
            time: Date.now(),
            user: existingUser,
          });
          await ctx.reply(languageText.shareText2, {
            reply_markup: {
              keyboard: [[{ text: languageText.goBack }]],
              resize_keyboard: true,
              one_time_keyboard: false,
              is_persistent: true,
            },
          });
          const shareText =
            languageText.shareText + "\n👉🏻 " + inviteLink;

          ctx.reply(shareText, {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: languageText.shareOnTelegram,
                    url: `https://t.me/share/url?url=${encodeURIComponent(
                      inviteLink,
                    )}&text=${encodeURIComponent(shareText)}`,
                  },
                ],
                [
                  {
                    text: languageText.shareOnWhatsApp,
                    url: `https://wa.me/?text=${encodeURIComponent(
                      shareText,
                    )}`,
                  },
                ],
              ],
            },
          });
          return;
        } else {
          try {
            ctx.reply(
              `1. ${languageText.viewProfiles}\n2. ${languageText.myProfile}\n3. ${languageText.sleepMode}\n----------------------------\n4. ${languageText.inviteFriendsText}`,
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
        }
      } else if (userStep === "invite") {
        if (ctx?.message?.text === languageText.goBack) {
          existingUser.userStep = "menu";
          usersMap.set(telegramId, {
            time: Date.now(),
            user: existingUser,
          });
          ctx.reply(
            `1. ${languageText.viewProfiles}\n2. ${languageText.myProfile}\n3. ${languageText.sleepMode}\n----------------------------\n4. ${languageText.inviteFriendsText}`,
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
          await ctx.reply(languageText.shareText2, {
            reply_markup: {
              keyboard: [[{ text: languageText.goBack }]],
              resize_keyboard: true,
              one_time_keyboard: false,
              is_persistent: true,
            },
          });
          const shareText =
            languageText.shareText + "\n👉🏻 " + inviteLink;

          ctx.reply(shareText, {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: languageText.shareOnTelegram,
                    url: `https://t.me/share/url?url=${encodeURIComponent(
                      inviteLink,
                    )}&text=${encodeURIComponent(shareText)}`,
                  },
                ],
                [
                  {
                    text: languageText.shareOnWhatsApp,
                    url: `https://wa.me/?text=${encodeURIComponent(
                      shareText,
                    )}`,
                  },
                ],
              ],
            },
          });
        }
      } else if (userStep === "changeLanguage") {
        if (
          !ctx?.message?.text ||
          !langsTextShow.map(String).includes(ctx?.message?.text)
        ) {
          try {
            ctx.reply(languageText.errorSelectLanguage, {
              reply_markup: {
                keyboard: chunkArray(langsTextShow, 2),
                resize_keyboard: true,
                one_time_keyboard: false,
                is_persistent: true,
              },
            });
          } catch (error) {
            ctx.reply(languageText.somethingWentWrong + "cl2");
          }
          return;
        } else {
          try {
            const findedLang =
              languages.find(
                (lang) => lang.text === ctx?.message?.text,
              ).langCode || "en";

            userLanguage = findedLang;
            languageText = texts.find(
              (text) => text.language === userLanguage,
            );

            existingUser.language = findedLang;
            existingUser.userStep = "menu";
            // await existingUser.save();

            usersMap.set(telegramId, {
              time: Date.now(),
              user: existingUser,
            });

            // save in redis
            await redisClient.hmset(`user:${telegramId}`, {
              language: findedLang,
            });

            await ctx.reply("✅");
            ctx.reply(
              `1. ${languageText.viewProfiles}\n2. ${languageText.myProfile}\n3. ${languageText.sleepMode}\n----------------------------\n4. ${languageText.inviteFriendsText}`,
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
            ctx.reply(languageText.somethingWentWrong + "r3");
          }
        }
      } else if (userStep === "sleep") {
        if (ctx?.message?.text === languageText.goBack) {
          try {
            existingUser.userStep = "menu";
            // await existingUser.save();
            usersMap.set(telegramId, {
              time: Date.now(),
              user: existingUser,
            });

            ctx.reply(
              `1. ${languageText.viewProfiles}\n2. ${languageText.myProfile}\n3. ${languageText.sleepMode}\n----------------------------\n4. ${languageText.inviteFriendsText}`,
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
          ctx?.message?.text === languageText.active ||
          ctx?.message?.text === languageText.inactive
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
              `1. ${languageText.viewProfiles}\n2. ${languageText.myProfile}\n3. ${languageText.sleepMode}\n----------------------------\n4. ${languageText.inviteFriendsText}`,
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
              `${languageText.sleepMode}: ${
                existingUser.sleep
                  ? languageText.active
                  : languageText.inactive
              }\n\n${languageText.sleepDetail}`,
              {
                reply_markup: {
                  keyboard: [
                    [
                      {
                        text: existingUser.sleep
                          ? languageText.inactive
                          : languageText.active,
                      },
                    ],
                    [{ text: languageText.goBack }],
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
        if (ctx?.message?.text === languageText.goBack) {
          try {
            existingUser.userStep = "notificationMenu";
            // await existingUser.save();
            usersMap.set(telegramId, {
              time: Date.now(),
              user: existingUser,
            });

            await ctx.reply(
              `${languageText.likedYouText}\n\n1. ${languageText.show}\n2. ${languageText.sleepMode}`,
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
          ctx?.message?.text === languageText.active ||
          ctx?.message?.text === languageText.inactive
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
              `${languageText.likedYouText}\n\n1. ${languageText.show}\n2. ${languageText.sleepMode}`,
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
              `${languageText.sleepMode}: ${
                existingUser.sleep
                  ? languageText.active
                  : languageText.inactive
              }\n\n${languageText.sleepDetail}`,
              {
                reply_markup: {
                  keyboard: [
                    [
                      {
                        text: existingUser.sleep
                          ? languageText.inactive
                          : languageText.active,
                      },
                    ],
                    [{ text: languageText.goBack }],
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

            await ctx.reply(`${languageText.likesText} :`, {
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
                const flag = userFromRedis.likers[0].flag;
                const bio = userFromRedis.likers[0].bio;
                const inviteCode = userFromRedis.likers[0].inviteCode;

                await ctx.replyWithMediaGroup(
                  photos.map((photo, index) => ({
                    type: "photo",
                    media: photo,
                    caption:
                      index === 0
                        ? `${fullName}, ${age}, ${
                            flag + " " + state
                          } ${bio ? "\n" + bio : ""}\n/user_${
                            inviteCode || "not_found"
                          }`
                        : undefined,
                  })),
                );
              }
            } else {
              ctx.reply(languageText.noLikes);
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
              `${languageText.sleepMode}: ${
                existingUser.sleep
                  ? languageText.active
                  : languageText.inactive
              }\n\n${languageText.sleepDetail}`,
              {
                reply_markup: {
                  keyboard: [
                    [
                      {
                        text: existingUser.sleep
                          ? languageText.inactive
                          : languageText.active,
                      },
                    ],
                    [{ text: languageText.goBack }],
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
          ctx.reply("no such option");
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

                if (likerUserName) {
                  await ctx.reply(
                    ` ${languageText.youAnd} ${fullName} ${languageText.matched} 🎉\n\n${languageText.startChatWithButton}`,
                    {
                      reply_markup: {
                        inline_keyboard: [
                          [
                            {
                              text: languageText.startChat,
                              url: `https://t.me/${likerUserName}?text=${languageText.hello} ${fullName} ${languageText.imFromPounes}`,
                            },
                          ],
                        ],
                      },
                    },
                  );
                } else {
                  try {
                    await ctx.reply(
                      ` ${languageText.youAnd} ${fullName} ${languageText.matched} 🎉\n\n${languageText.startChatWithButton}`,
                      {
                        reply_markup: {
                          inline_keyboard: [
                            [
                              {
                                text: languageText.startChat,
                                url: `tg://user?id=${likerTelegramId}&text=${languageText.hello} ${fullName} ${languageText.imFromPounes}`,
                              },
                            ],
                          ],
                        },
                      },
                    );
                  } catch (error) {
                    if (usersMap.get(likerTelegramId)) {
                      usersMap.get(
                        likerTelegramId,
                      ).user.unavailablePv = true;
                      usersMap.set(likerTelegramId, {
                        time: Date.now(),
                        user: usersMap.get(likerTelegramId).user,
                      });
                    } else {
                      const updatedUser = await User.findOneAndUpdate(
                        { telegramId: likerTelegramId },
                        { unavailablePv: true },
                        { new: true },
                      );
                      usersMap.set(likerTelegramId, {
                        time: Date.now(),
                        user: updatedUser,
                      });
                    }
                  }
                }

                if (userName) {
                  await bot.telegram.sendMessage(
                    +likerTelegramId,
                    ` ${languageText.youAnd} ${existingUser.fullName} ${languageText.matched} 🎉\n\n${languageText.startChatWithButton}`,
                    {
                      reply_markup: {
                        inline_keyboard: [
                          [
                            {
                              text: languageText.startChat,
                              url: `https://t.me/${userName}?text=${languageText.hello} ${existingUser.fullName} ${languageText.imFromPounes}`,
                            },
                          ],
                        ],
                      },
                    },
                  );
                } else {
                  try {
                    await bot.telegram.sendMessage(
                      +likerTelegramId,
                      `${languageText.youAnd} ${existingUser.fullName} ${languageText.matched} 🎉\n\n${languageText.startChatWithButton}`,
                      {
                        reply_markup: {
                          inline_keyboard: [
                            [
                              {
                                text: languageText.startChat,
                                url: `tg://user?id=${telegramId}&text=${languageText.hello} ${fullName} ${languageText.imFromPounes}`,
                              },
                            ],
                          ],
                        },
                      },
                    );
                  } catch (error) {
                    existingUser.unavailablePv = true;
                    usersMap.set(telegramId, {
                      time: Date.now(),
                      user: existingUser,
                    });
                  }
                }

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
                  const flag = list[0].flag;
                  const bio = list[0].bio;
                  const inviteCode = list[0].inviteCode;

                  await ctx.replyWithMediaGroup(
                    photos.map((photo, index) => ({
                      type: "photo",
                      media: photo,
                      caption:
                        index === 0
                          ? `${fullName}, ${age}, ${
                              flag + " " + state
                            } ${bio ? "\n" + bio : ""}\n/user_${
                              inviteCode || "not_found"
                            }`
                          : undefined,
                    })),
                  );
                } else {
                  ctx.reply(languageText.endOfLikes);
                  existingUser.userStep = "menu";

                  usersMap.set(telegramId, {
                    time: Date.now(),
                    user: existingUser,
                  });
                  // await existingUser.save();

                  ctx.reply(
                    `1. ${languageText.viewProfiles}\n2. ${languageText.myProfile}\n3. ${languageText.sleepMode}\n----------------------------\n4. ${languageText.inviteFriendsText}`,
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
                //   `<a href="https://t.me/${"Abolfazl021aaaa"}?text=سلام ${fullName}، از طریق تلگرام با شما آشنا شدم 😊">💬 شروع چت</a>`,
                //   { parse_mode: "HTML" },
                // );
              } else {
                console.log("notif step 3-1 ---");
                ctx.reply(languageText.endOfLikes);
                existingUser.userStep = "menu";
                usersMap.set(telegramId, {
                  time: Date.now(),
                  user: existingUser,
                });
                // await existingUser.save();

                ctx.reply(
                  `1. ${languageText.viewProfiles}\n2. ${languageText.myProfile}\n3. ${languageText.sleepMode}\n----------------------------\n4. ${languageText.inviteFriendsText}`,
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
              ctx.reply(languageText.noLikesText);
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
                  const flag = list[0].flag;
                  const bio = list[0].bio;
                  const inviteCode = list[0].inviteCode;

                  await ctx.replyWithMediaGroup(
                    photos.map((photo, index) => ({
                      type: "photo",
                      media: photo,
                      caption:
                        index === 0
                          ? `${fullName}, ${age}, ${
                              flag + " " + state
                            } ${bio ? "\n" + bio : ""}\n/user_${
                              inviteCode || "not_found"
                            }`
                          : undefined,
                    })),
                  );
                } else {
                  ctx.reply(languageText.endOfLikes);
                  existingUser.userStep = "menu";

                  usersMap.set(telegramId, {
                    time: Date.now(),
                    user: existingUser,
                  });
                  // await existingUser.save();

                  ctx.reply(
                    `1. ${languageText.viewProfiles}\n2. ${languageText.myProfile}\n3. ${languageText.sleepMode}\n----------------------------\n4. ${languageText.inviteFriendsText}`,
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
                //   `<a href="https://t.me/${"Abolfazl021aaaa"}?text=سلام ${fullName}، از طریق تلگرام با شما آشنا شدم 😊">💬 شروع چت</a>`,
                //   { parse_mode: "HTML" },
                // );
              } else {
                console.log("notif step 3-1 ---");
                ctx.reply(languageText.endOfLikes);
                existingUser.userStep = "menu";
                usersMap.set(telegramId, {
                  time: Date.now(),
                  user: existingUser,
                });
                // await existingUser.save();

                ctx.reply(
                  `1. ${languageText.viewProfiles}\n2. ${languageText.myProfile}\n3. ${languageText.sleepMode}\n----------------------------\n4. ${languageText.inviteFriendsText}`,
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
              ctx.reply(languageText.noLikesText);
            }
          } catch (error) {
            console.log(error);
          }
        } else {
          ctx.reply("no such option");
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
              flag,
              bio,
              profileImages,
              inviteCode: inviteCode_from_forYouList,
            } = forYouList.get(telegramId)[0];
            userTelId = forYouList.get(telegramId)[0].telegramId;

            const photos = profileImages;

            try {
              await bot.telegram.sendMessage(
                +existingUser.lastViewed,
                `${languageText.youHaveANewMessageFrom} ${
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
            await ctx.reply(languageText.messageSent, {
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

            await ctx.replyWithMediaGroup(
              photos.map((photo, index) => ({
                type: "photo",
                media: photo,
                caption:
                  index === 0
                    ? `${fullName}, ${age}, ${flag + " " + state} ${
                        bio ? "\n" + bio : ""
                      } \n/user_${
                        inviteCode_from_forYouList || "not_found"
                      }`
                    : undefined,
              })),
            );
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
          ctx.reply(languageText.pleaseSendOnlyTextMessage);
        }
      } else if (userStep === "answer") {
        if (ctx?.message?.text === languageText.goBack) {
          existingUser.userStep = "menu";
          usersMap.set(telegramId, {
            time: Date.now(),
            user: existingUser,
          });
          ctx.reply(
            `1. ${languageText.viewProfiles}\n2. ${languageText.myProfile}\n3. ${languageText.sleepMode}\n----------------------------\n4. ${languageText.inviteFriendsText}`,
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
            ctx.reply(languageText.somethingWentWrong);
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
                `${languageText.youHaveANewMessageFrom} ${
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
            await ctx.reply(languageText.messageSent, {
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

            await ctx.replyWithMediaGroup(
              photos.map((photo, index) => ({
                type: "photo",
                media: photo,
                caption:
                  index === 0
                    ? `${fullName}, ${age}, ${flag + " " + state} ${
                        bio ? "\n" + bio : ""
                      } \n/user_${
                        inviteCode_from_forYouList || "not_found"
                      }`
                    : undefined,
              })),
            );
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
          ctx.reply(languageText.pleaseSendOnlyTextMessage);
        }
      } else if (userStep === "userProfile") {
        if (ctx?.message?.text === languageText.report) {
          ctx.reply(
            `${languageText.whyReport} /user_${existingUser.userProfile.inviteCode}`,
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: languageText.reportAdvertisement, // "تبلیغات"
                      callback_data: `report_advertisement`,
                    },
                  ],
                  [
                    {
                      text: languageText.reportInappropriateContent, // "ارسال محتوای غیر اخلاقی"
                      callback_data: `report_inappropriate_content`,
                    },
                  ],
                  [
                    {
                      text: languageText.reportHarassment, // "ایجاد مزاحمت"
                      callback_data: `report_harassment`,
                    },
                  ],
                  [
                    {
                      text: languageText.reportPhoneNumber, // "پخش شماره موبایل یا اطلاعات شخصی دیگران"
                      callback_data: `report_phone_number`,
                    },
                  ],
                  [
                    {
                      text: languageText.reportInappropriateProfile, // "کلمات یا عکس غیراخلاقی در پروفایل"
                      callback_data: `report_inappropriate_profile`,
                    },
                  ],
                  [
                    {
                      text: languageText.reportIncorrectGender, // "جنسیت اشتباه در پروقایل"
                      callback_data: `report_incorrect_gender`,
                    },
                  ],
                  [
                    {
                      text: languageText.reportOther, // "دیگر موارد ..."
                      callback_data: `report_other`,
                    },
                  ],
                ],
              },
            },
          );
        } else if (
          ctx?.message?.text === languageText.backToMainMenu
        ) {
          existingUser.userStep = "menu";
          usersMap.set(telegramId, {
            time: Date.now(),
            user: existingUser,
          });
          ctx.reply(
            `1. ${languageText.viewProfiles}\n2. ${languageText.myProfile}\n3. ${languageText.sleepMode}\n----------------------------\n4. ${languageText.inviteFriendsText}`,
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
            `1. ${languageText.viewProfiles}\n2. ${languageText.myProfile}\n3. ${languageText.sleepMode}\n----------------------------\n4. ${languageText.inviteFriendsText}`,
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
          languageText.giftLikeCount,
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
        langsTextShow,
        ages,
        countriesTextShow,
        texts,
        chunkArray,
        telegramId,
        languages,
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
bot.on("message", async (ctx) => {
  await processStatement(ctx);
});

// bot.start(async (ctx) => {
//   await ctx.reply(`قبل از خرید حتما فیلتر شکن خود را خاموش کنید ♦️`, {
//     reply_markup: {
//       inline_keyboard: [
//         [
//           {
//             text: "پرداخت",
//             url: "https://google.com",
//           },
//         ],
//       ],
//     },
//   });
// });
bot.help((ctx) => ctx.reply("Send me a sticker"));
bot.on(message("sticker"), (ctx) => ctx.reply("👍"));
bot.hears("hi", (ctx) => ctx.reply("Hey there"));
bot.launch();

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
