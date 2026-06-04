const { checkUrl } = require("../utils/checkUrl");

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
