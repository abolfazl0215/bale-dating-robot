"use strict";

const User = require("../models/User");
const { reply } = require("../telegram_methods/reply.js");
const { generateInviteCode } = require("../utils/generateInviteCode");
const state = require("../app/state");
const { redisClient } = require("../config/redis");
const { registerPaymentHandlers } = require("./payments");
const { registerReportHandlers } = require("./reports");
const { checkUrl } = require("../utils/checkUrl.js");
const { encrypt } = require("../utils/encrypt.js");

function registerBotHandlers(bot, processStatement) {
  const { usersMap, appIds } = state;

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
      const findUser = await User.findOne({
        telegramId: ctx.from.id,
      });
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
        await ctx.replyWithPhoto(checkUrl(photo), {
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

  registerPaymentHandlers(bot);

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
  bot.action("set_telegram_username", async (ctx, next) => {
    try {
      await ctx.answerCbQuery(); // حذف لودینگ دکمه

      const telegramId = ctx?.from?.id;
      const userName = ctx?.from?.username;

      if (!userName) {
        await reply(
          ctx,
          next,
          redisClient,
          "هنوز userName ندارید \n\n- لطفا ابتدا یک نام کاربری (آیدی) انتخاب کنید",
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
        const data_ = {
          telegramId: String(telegramId),
          userName: userName,
        };

        const encryptedData = encrypt(data_);

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
                url: `https://redirect-to-app-delta.vercel.app/open?data=${encryptedData}`,
              },
            ],
            [
              {
                text: "ورود به برنامه 😎 (با اینترنت داخلی)",
                url: `https://pounes.ir/open?data=${encryptedData}`,
              },
            ],
          ],
        );
      }
    } catch (error) {
      console.log(error);
    }
  });

  registerReportHandlers(bot, usersMap);
}

module.exports = { registerBotHandlers };
