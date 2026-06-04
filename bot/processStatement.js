"use strict";

const { registerInBot } = require("../components/registerInBot.js");
const editProfileInBot = require("../components/editProfileInBot.js");
const { changePhoto } = require("../components/changePhoto.js");
const User = require("../models/User");
const chunkArray = require("../utils/chunkArray");
const editProfileMenu = require("../components/userSteps/editProfileMenu.js");
const searchStep = require("../components/userSteps/searchStep.js");
const menuStep = require("../components/userSteps/menuStep.js");
const { reply } = require("../telegram_methods/reply.js");
const { replyBot } = require("../telegram_methods/replyBot.js");
const { generateInviteCode } = require("../utils/generateInviteCode");
const { AGES, BOT_INVITE_BASE } = require("../app/config");
const state = require("../app/state");
const dailyReport = require("../app/dailyReport");
const protobuf = require("../app/protobuf");
const session = require("../app/session");
const {
  redisClient,
  globalOperationsQueue,
  activeUsersQueue,
  newLikeQueue,
  requestToFillSuggestQueue,
} = require("../config/redis");
const { checkUrl } = require("../utils/checkUrl.js");

function createProcessStatement() {
  const {
    usersMap,
    forYouList,
    forYouTime,
    blockedUsers,
    lastViewed,
    lastTimeAddProfileToList,
  } = state;
  const { temporaryDailyReport, currentActiveUsers } = dailyReport;
  const { getNowTime } = session;

  const ages = AGES;

  const generateInviteLink = (telegramId) =>
    `${BOT_INVITE_BASE}${generateInviteCode(telegramId)}`;

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
        await protobuf.loadNewLikeProto();
      } catch (error) {
        console.log(error);
      }
      // load new like protoBuffer  >>>>>>>>>>>>>>>>>>>>
      // load new like protoBuffer  >>>>>>>>>>>>>>>>>>>>

      // load for you protoBuffer  <<<<<<<<<<<<<<<<<<<<<
      // load for you protoBuffer  <<<<<<<<<<<<<<<<<<<<<
      try {
        await protobuf.loadActiveUsersProto();
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
          console.log(
            "find a block ............ ",
            ctx?.message?.text,
          );
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
          existingUser = await User.findOne({
            telegramId,
            platform: global.currentPlatform,
          });
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
        if (inviteCode && inviteCode.startsWith("joinapp")) {
          try {
            await User.findByIdAndUpdate(existingUser._id, {
              appId: inviteCode,
            });
            return await reply(
              ctx,
              next,
              redisClient,
              "ورود موفقیت آمیز بود ✅\nلطفا به برنامه برگردید .",
              [],
              [
                [
                  {
                    text: "ادامه  در ربات",
                    callback_data: "done_start",
                  },
                ],
              ],
            );
          } catch (error) {}
        }
        if (inviteCode && inviteCode.startsWith("setusername")) {
          if (userName) {
            await reply(
              ctx,
              next,
              redisClient,
              "نام کاربری شما تنظیم شد ✅\n\n -لطفا به برنامه بازگردید",
              [],
              [
                [
                  {
                    text: "ادامه  در ربات",
                    callback_data: "done_start",
                  },
                ],
              ],
            );
          } else {
            await reply(
              ctx,
              next,
              redisClient,
              `شما هنوز نام کاربری تنظیم نکرده اید \n\n- لطفا یک نام کاربری (آیدی) برای خود در "${!existingUser?.platform || existingUser?.platform == "bale" ? "بله" : "تلگرام"}" انتخاب کنید`,
            );
          }
          return;
        }
        if (inviteCode && inviteCode.startsWith("guest-")) {
          try {
            // ─── 1. Extract ID safely ─────────────────────────────
            const parts = inviteCode.split("-");

            const rawId = parts[1];

            const idToNum = Number(rawId);

            // ─── 2. Find current user ─────────────────────────────
            const findByTelId = await User.findOne({ telegramId });

            // ─── 3. CASE: user exists ──────────────────────────────
            if (findByTelId) {
              findByTelId.appId = String(idToNum);
              await findByTelId.save();
            } else {
              // ─── 4. CASE: migrate existing app user ──────────────
              const findUserByAppId = await User.findOne({
                appId: String(idToNum),
              });

              if (!findUserByAppId) return;

              findUserByAppId.telegramId = telegramId;
              findUserByAppId.appId = String(idToNum);

              await findUserByAppId.save();
            }

            // ─── 5. Success response ──────────────────────────────
            await reply(
              ctx,
              next,
              redisClient,
              "با موفقیت متصل شدید ✅\n\nلطفا به برنامه بازگردید",
              [],
              [
                [
                  {
                    text: "ادامه در ربات",
                    callback_data: "done_start",
                  },
                ],
              ],
            );

            return;
          } catch (error) {
            console.error("inviteCode error:", error);
            return;
          }
        }
        if (inviteCode && inviteCode.startsWith("joinwithtelegram")) {
          if (!userName) {
            await reply(
              ctx,
              next,
              redisClient,
              "تلگرام شما باید یک نام کاربری (آیدی) داشته باشد \n\n- لطفا ایتدا یک نام کاربری انتخاب کنید",
              [],
              [
                [
                  {
                    text: "انجام دادم ✅",
                    callback_data: "set_telegram_username",
                  },
                ],
              ],
            );
          } else {
            await reply(
              ctx,
              next,
              redisClient,
              "از طریق دکمه زیر وارد برنامه شوید 👇🏻",
              [],
              [
                [
                  {
                    text: "ورود به برنامه 😎 (با اینترنت بین الملل)",
                    url: `https://redirect-to-app-delta.vercel.app/open?data=${telegramId}`,
                  },
                ],
                [
                  {
                    text: "ورود به برنامه 😎 (با اینترنت داخلی)",
                    url: `https://pounes.ir/open?data=${telegramId}`,
                  },
                ],
              ],
            );
          }
          return;
        }
        // after 8 minutes and 20 seconds add profile to forYou queue again and update last time <<<
        const userStep = existingUser?.userStep || "register";
        if (userStep !== "register") {
          const lastTime =
            lastTimeAddProfileToList.get(telegramId) ?? 0;
          if (lastTime + 500000 < Date.now()) {
            lastTimeAddProfileToList.set(telegramId, Date.now());
            activeUsersQueue.add({ telegramId });
          }
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
          //   `state.globalUsers:${lookFor.toLowerCase()}`,
          // );

          // if (Buffer.isBuffer(getDataGlobal)) {
          //   await loadActiveUsersProto();
          //   const decodedMessage =
          //     ActiveUsersProto.decode(getDataGlobal);
          //   const usersArrayFromRedis = decodedMessage.users || [];
          //   const subArray = usersArrayFromRedis.slice(0, 10);

          forYouList.set(telegramId, [...state.globalUsers]);
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
            protobuf.ActiveUsersProto,
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
            protobuf.ActiveUsersProto,
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
                  (totalMilliseconds % (1000 * 60 * 60)) /
                    (1000 * 60),
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
              const item =
                forYouList.get(telegramId)?.[0]?.telegramId;
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
            forYouTime.get(telegramId)
            // &&
            // forYouTime.get(telegramId) + 600000 > Date.now()
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
                telegramId:
                  +forYouList.get(telegramId)[0]?.telegramId,
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

            const targetId = forYouList.get(telegramId)?.[0]
              ?.telegramId
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
            // userTelId = forYouList.get(telegramId)[0].telegramId;

            const photos = profileImages;

            try {
              // const buffer = await getPic(photos[0]);
              await ctx.replyWithPhoto(
                checkUrl(photos[0]),
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
            // console.log({ nextUser:nextUser.telegramId });
            // userTelId = forYouList.get(telegramId)[0].telegramId;

            const photos = profileImages;

            try {
              // const buffer = await getPic(photos[0]);
              await ctx.replyWithPhoto(
                checkUrl(photos[0]),
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
                await protobuf.loadNewLikeProto();
                const decodedMessage =
                  protobuf.NewLikeProto.decode(getData);
                let usersArrayFromRedis = decodedMessage.users || [];
                const userFromRedis = usersArrayFromRedis.find(
                  (user) => +user.telegramId === +telegramId,
                );
                if (
                  userFromRedis &&
                  Array.isArray(userFromRedis.likers) &&
                  userFromRedis.likers.length > 0
                ) {
                  const photos =
                    userFromRedis.likers[0].profileImages;
                  const fullName = userFromRedis.likers[0].fullName;
                  const age = userFromRedis.likers[0].age;
                  const state = userFromRedis.likers[0].state;
                  const bio = userFromRedis.likers[0].bio;
                  const textMessage =
                    userFromRedis.likers[0]?.message;
                  const inviteCode_ =
                    userFromRedis.likers[0].inviteCode;

                  try {
                    // const buffer = await getPic(photos[0]);
                    await ctx.replyWithPhoto(checkUrl(photos[0]), {
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
                await protobuf.loadNewLikeProto();
                const decodedMessage =
                  protobuf.NewLikeProto.decode(getData);
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
                  const textMessage =
                    userFromRedis.likers[0]?.message;

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
                        getLiker.subscriptionExpireTime >
                          Date.now()) ||
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
                      const existingMatch =
                        existingUser.matches.splice(
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
                      findContact =
                        usersMap.get(+likerTelegramId).user;
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

                    const message_ = protobuf.NewLikeProto.create({
                      users: updatedUsersArray,
                    });
                    const buffer =
                      protobuf.NewLikeProto.encode(message_).finish();
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
                      await ctx.replyWithPhoto(checkUrl(photos[0]), {
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
                await protobuf.loadNewLikeProto();
                const decodedMessage =
                  protobuf.NewLikeProto.decode(getData);
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

                      const updatedUsersArray =
                        usersArrayFromRedis.map((user) => {
                          if (+user.telegramId === +telegramId) {
                            return {
                              ...user,
                              likers: list,
                              time: Date.now(),
                            };
                          }
                          return user;
                        });

                      const message_ = protobuf.NewLikeProto.create({
                        users: updatedUsersArray,
                      });
                      const buffer =
                        protobuf.NewLikeProto.encode(
                          message_,
                        ).finish();
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
                        checkUrl(photos[0]),

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
              // userTelId = forYouList.get(telegramId)[0].telegramId;

              const photos = profileImages;
              await ctx.replyWithPhoto(checkUrl(photos[0]), {
                caption: `${fullName}, ${age}, ${state} ${
                  bio ? "\n" + bio : ""
                } \n/user_${inviteCode_from_forYouList || "not_found"}`,
              });
            } catch (error) {
              try {
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
                // userTelId = forYouList.get(telegramId)[0].telegramId;
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
                telegramId:
                  +forYouList.get(telegramId)[0]?.telegramId,
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

            const targetId = forYouList.get(telegramId)?.[0]
              ?.telegramId
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
            // userTelId = forYouList.get(telegramId)[0].telegramId;

            const photos = profileImages;

            try {
              // const buffer = await getPic(photos[0]);
              await ctx.replyWithPhoto(
                checkUrl(photos[0]),
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
                // userTelId = forYouList.get(telegramId)[0].telegramId;

                const photos = profileImages;

                await ctx.replyWithPhoto(checkUrl(photos[0]), {
                  caption: `${fullName}, ${age}, ${state} ${
                    bio ? "\n" + bio : ""
                  } \n/user_${inviteCode_from_forYouList || "not_found"}`,
                });
              } catch (error) {
                try {
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
                  contact.blocksMe = [
                    ...contact.blocksMe,
                    +telegramId,
                  ];
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
              await reply(
                ctx,
                next,
                redisClient,
                "کاربر آنبلاک شد ✅",
              );
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

          if (inviteByUser) {
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
              usersMap.get(
                +inviteByUser.telegramId,
              ).user.giftLikeCount += 50;
              usersMap.set(+inviteByUser.telegramId, {
                user: usersMap.get(+inviteByUser.telegramId).user,
                time: Date.now(),
              });
            }
          }
        }

        if (inviteCode && inviteCode.startsWith("setusername")) {
          if (userName) {
            await reply(
              ctx,
              next,
              redisClient,
              "نام کاربری شما تنظیم شد ✅\n\n -لطفا به برنامه بازگردید",
            );
          } else {
            await reply(
              ctx,
              next,
              redisClient,
              "شما هنوز نام کاربری تنظیم نکرده اید \n\n- لطفا یک نام کاربری (آیدی) برای خود انتخاب کنید",
            );
          }
          return;
        }
        if (inviteCode && inviteCode.startsWith("guest-")) {
          try {
            // ─── 1. Extract ID safely ─────────────────────────────
            const parts = inviteCode.split("-");

            const rawId = parts[1];

            const idToNum = Number(rawId);

            // ─── 2. Find current user ─────────────────────────────
            const findByTelId = await User.findOne({ telegramId });

            // ─── 3. CASE: user exists ──────────────────────────────
            if (findByTelId) {
              findByTelId.appId = String(idToNum);
              await findByTelId.save();
            } else {
              // ─── 4. CASE: migrate existing app user ──────────────
              const findUserByAppId = await User.findOne({
                appId: String(idToNum),
              });

              if (!findUserByAppId) return;

              findUserByAppId.telegramId = telegramId;
              findUserByAppId.appId = String(idToNum);

              await findUserByAppId.save();
            }

            // ─── 5. Success response ──────────────────────────────
            await reply(
              ctx,
              next,
              redisClient,
              "با موفقیت متصل شدید ✅\n\nلطفا به برنامه بازگردید",
              [],
              [
                [
                  {
                    text: "ادامه در ربات",
                    callback_data: "done_start",
                  },
                ],
              ],
            );

            return;
          } catch (error) {
            console.error("inviteCode error:", error);
            return;
          }
        }
        if (inviteCode && inviteCode.startsWith("joinapp")) {
          const saveduser = await User.create({
            telegramId,
            userName,
            inviteCode: generateInviteCode(telegramId),
            inviteBy: inviteCode || null,
            platform: global.currentPlatform,
            appId: inviteCode,
          });
          return await reply(
            ctx,
            next,
            redisClient,
            "ورود موفقیت آمیز بود ✅\nلطفا به برنامه برگردید .",
            [],
            [
              [
                {
                  text: "ادامه  در ربات",
                  callback_data: "done_start",
                },
              ],
            ],
          );
        }
        if (inviteCode && inviteCode.startsWith("joinwithtelegram")) {
          if (!userName) {
            await reply(
              ctx,
              next,
              redisClient,
              "تلگرام شما باید یک نام کاربری (آیدی) داشته باشد \n\n- لطفا ایتدا یک نام کاربری انتخاب کنید",
              [],
              [
                [
                  {
                    text: "انجام دادم ✅",
                    callback_data: "set_telegram_username",
                  },
                ],
              ],
            );
          } else {
            await reply(
              ctx,
              next,
              redisClient,
              "از طریق دکمه زیر وارد برنامه شوید 👇🏻",
              [],
              [
                [
                  {
                    text: "ورود به برنامه 😎 (با اینترنت بین الملل)",
                    url: `https://redirect-to-app-delta.vercel.app/open?data=${telegramId}`,
                  },
                ],
                [
                  {
                    text: "ورود به برنامه 😎 (با اینترنت داخلی)",
                    url: `https://pounes.ir/open?data=${telegramId}`,
                  },
                ],
              ],
            );
          }
          return;
        }
        const saveduser = await User.create({
          telegramId,
          userName,
          inviteCode: generateInviteCode(telegramId),
          inviteBy: inviteCode || null,
          platform: global.currentPlatform,
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
          protobuf.ActiveUsersProto,
        );
      }
    } catch (error) {
      console.log(error);
    }
  };

  return processStatement;
}

module.exports = { createProcessStatement };
