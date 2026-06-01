const User = require("../models/User");
const { uploadImageFromUrl } = require("./uploadImageFromUrl");
const badWords = require("../data/words");
const protobuf = require("protobufjs");
const usersMap = require("../utils/usersMap");
const Pictures = require("../models/Pictures");
const fs = require("fs");
const { reply } = require("../telegram_methods/reply");
const { requestToFillSuggestQueue } = require("../config/redis");

function containsLinkOrTelegramID(str) {
  // الگوی کلی برای تشخیص انواع لینک‌های URL
  // این الگو شامل http, https, ftp, www. و دامنه‌های معمولی هست
  const urlPattern =
    /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|]|\bwww\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;

  // الگوی تشخیص آیدی تلگرام (@username)
  // حداقل ۵ کاراکتر بعد از @ و فقط حروف، اعداد و خط زیر مجاز هستند
  const telegramUsernamePattern =
    /(^|[^a-zA-Z0-9_])@[A-Za-z0-9_]{5,}/;

  // چک می‌کنیم که آیا رشته شامل لینک هست یا آیدی تلگرام
  const hasLink = urlPattern.test(str);
  const hasTelegramID = telegramUsernamePattern.test(str);

  return hasLink || hasTelegramID;
}

const states = [
  { local: "آذربایجان شرقی", english: "East Azerbaijan" },
  { local: "تهران", english: "Tehran" },
  { local: "آذربایجان غربی", english: "West Azerbaijan" },
  { local: "اردبیل", english: "Ardabil" },
  { local: "اصفهان", english: "Isfahan" },
  { local: "البرز", english: "Alborz" },
  { local: "ایلام", english: "Ilam" },
  { local: "بوشهر", english: "Bushehr" },
  {
    local: "چهارمحال و بختیاری",
    english: "Chaharmahal and Bakhtiari",
  },
  { local: "خراسان جنوبی", english: "South Khorasan" },
  { local: "خراسان رضوی", english: "Razavi Khorasan" },
  { local: "خراسان شمالی", english: "North Khorasan" },
  { local: "خوزستان", english: "Khuzestan" },
  { local: "زنجان", english: "Zanjan" },
  { local: "سمنان", english: "Semnan" },
  {
    local: "سیستان و بلوچستان",
    english: "Sistan and Baluchestan",
  },
  { local: "فارس", english: "Fars" },
  { local: "قزوین", english: "Qazvin" },
  { local: "قم", english: "Qom" },
  { local: "کردستان", english: "Kurdistan" },
  { local: "کرمان", english: "Kerman" },
  { local: "کرمانشاه", english: "Kermanshah" },
  {
    local: "کهگیلویه و بویراحمد",
    english: "Kohgiluyeh and Boyer-Ahmad",
  },
  { local: "گلستان", english: "Golestan" },
  { local: "گیلان", english: "Gilan" },
  { local: "لرستان", english: "Lorestan" },
  { local: "مازندران", english: "Mazandaran" },
  { local: "مرکزی", english: "Markazi" },
  { local: "هرمزگان", english: "Hormozgan" },
  { local: "همدان", english: "Hamadan" },
  { local: "یزد", english: "Yazd" },
];

const registerInBot = async (
  ctx,
  next,
  ages,
  chunkArray,
  telegramId,
  telegramName,
  savedUser,
  redisClient,
  forYouList,
  forYouTime,
  activeUsersQueue,
  ActiveUsersProto,
) => {
  if (!telegramId) {
    try {
      // await ctx.reply("مشکلی پیش آمده است");

      await reply(ctx, next, redisClient, "مشکلی پیش آمده است");
    } catch (error) {
      console.log(error);
    }
    return;
  }

  const step = savedUser.registerStep;
  console.log({ step });
  console.log({ telegramIdddddddd: telegramId });

  if (step === "welcomeMessage" || !step) {
    // console.log(ctx?.message?.text);
    if (ctx?.message?.text !== "بزن بریم 🚀") {
      savedUser.registerStep = "welcomeMessage";
      // await savedUser.save();
      await User.findOneAndUpdate(
        { telegramId },
        { registerStep: "welcomeMessage" },
      );

      usersMap.set(telegramId, {
        time: Date.now(),
        user: savedUser,
      });

      try {
        // await ctx.reply(
        //   `همین حالا هزاران نفر در پونس مچ همدیگه رو پیدا می‌کنن 😉 \n\nمن بهت کمک می‌کنم که یه دوست پیدا کنی 👫`,
        //   {
        //     reply_markup: {
        //       keyboard: [[{ text: "بزن بریم 🚀" }]],
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
          `همین حالا هزاران نفر در پونس مچ همدیگه رو پیدا می‌کنن 😉 \n\nمن بهت کمک می‌کنم که یه دوست پیدا کنی 👫`,
          [[{ text: "بزن بریم 🚀" }]],
        );
      } catch (error) {
        console.log("errorrrr --------------------------- 🚀🚀");
        console.log(error);
        try {
          // await ctx.reply(
          //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
          //     "r5",
          // );
          await reply(
            ctx,
            next,
            redisClient,
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)",
          );
        } catch (e) {}
      }
      return;
    } else {
      savedUser.registerStep = "age";
      // await savedUser.save();
      await User.findOneAndUpdate(
        { telegramId },
        { registerStep: "age" },
      );

      usersMap.set(telegramId, {
        time: Date.now(),
        user: savedUser,
      });

      try {
        // await ctx.reply("سن خود را انتخاب کنید\n\n⚪️⚪️⚪️⚪️⚪️⚪️⚪️🟢", {
        //   reply_markup: {
        //     keyboard: [...chunkArray(ages, 4)],
        //     resize_keyboard: true,
        //     one_time_keyboard: false,
        //     is_persistent: true,
        //   },
        // });
        await reply(
          ctx,
          next,
          redisClient,
          "سن خود را انتخاب کنید\n\n⚪️⚪️⚪️⚪️⚪️⚪️⚪️🟢",
          [...chunkArray(ages, 4)],
        );
      } catch (error) {
        console.log(error);
        try {
          // await ctx.reply(
          //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
          //     "r5",
          // );
          await reply(
            ctx,
            next,
            redisClient,
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)",
          );
        } catch (e) {}
      }
    }
  }
  if (step === "age") {
    if (
      !ctx?.message?.text ||
      !Number(ctx?.message?.text) ||
      !ages.includes(Number(ctx?.message?.text))
    ) {
      savedUser.registerStep = "age";
      // await savedUser.save();

      await User.findOneAndUpdate(
        { telegramId },
        { registerStep: "age" },
      );

      usersMap.set(telegramId, {
        time: Date.now(),
        user: savedUser,
      });

      try {
        // await ctx.reply("خطا در انتخاب سن", {
        //   reply_markup: {
        //     keyboard: [...chunkArray(ages, 4)],
        //     resize_keyboard: true,
        //     one_time_keyboard: false,
        //     is_persistent: true,
        //   },
        // });
        await reply(ctx, next, redisClient, "خطا در انتخاب سن", [
          ...chunkArray(ages, 4),
        ]);
      } catch (error) {
        // ctx.reply(+"r8");
        console.log(error);
      }
    } else {
      savedUser.registerStep = "gender";
      savedUser.age = Number(ctx?.message?.text) || 1;
      // await savedUser.save();
      await User.findOneAndUpdate(
        { telegramId },
        {
          age: Number(ctx?.message?.text) || 1,
          registerStep: "gender",
        },
      );

      usersMap.set(telegramId, {
        time: Date.now(),
        user: savedUser,
      });

      try {
        await reply(
          ctx,
          next,
          redisClient,
          "جنسیت خود را انتخاب کنید\n\n⭕غیرقابل تغییر⭕\n⭕در انتخاب خود دقت کنید⭕\n\n⚪️⚪️⚪️⚪️⚪️⚪️🟢🟢",
          [
            [
              {
                text: "خانم 💁‍♀️",
              },
              {
                text: "آقا 🙆‍♂️",
              },
            ],
            [
              {
                text: "مرحله قبلی",
              },
            ],
          ],
        );
      } catch (error) {
        console.log(error);
        try {
          // await ctx.reply(
          //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
          //     "r5",
          // );
          await reply(
            ctx,
            next,
            redisClient,
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)",
          );
        } catch (e) {}
      }
    }
  }
  if (step === "gender") {
    if (
      ctx?.message?.text === "خانم 💁‍♀️" ||
      ctx?.message?.text === "آقا 🙆‍♂️"
    ) {
      savedUser.registerStep = "lookingFor";
      savedUser.gender =
        ctx?.message?.text === "خانم 💁‍♀️" ? "female" : "male";
      // await savedUser.save();

      await User.findOneAndUpdate(
        { telegramId },
        { registerStep: "lookingFor", gender: savedUser.gender },
      );

      usersMap.set(telegramId, {
        time: Date.now(),
        user: savedUser,
      });

      try {
        // await ctx.reply("دنبال چه کسی میگردید  ؟\n\n⚪️⚪️⚪️⚪️⚪️🟢🟢🟢", {
        //   reply_markup: {
        //     keyboard: [
        //       [
        //         { text: "خانم 💁‍♀️" },
        //         { text: "آقا 🙆‍♂️" },
        //         { text: "فرقی ندارد ⚧️" },
        //       ],
        //       [{ text: "مرحله قبلی" }],
        //     ],
        //     resize_keyboard: true,
        //     one_time_keyboard: false,
        //     is_persistent: true,
        //   },
        // });
        await reply(
          ctx,
          next,
          redisClient,
          "دنبال چه کسی میگردید  ؟\n\n⚪️⚪️⚪️⚪️⚪️🟢🟢🟢",
          [
            [
              { text: "خانم 💁‍♀️" },
              { text: "آقا 🙆‍♂️" },
              { text: "فرقی ندارد ⚧️" },
            ],
            [{ text: "مرحله قبلی" }],
          ],
        );
      } catch (error) {
        console.log(error);
        try {
          // await ctx.reply(
          //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
          //     "r5",
          // );
          await reply(
            ctx,
            next,
            redisClient,
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)",
          );
        } catch (e) {}
      }
    } else if (ctx?.message?.text === "مرحله قبلی") {
      savedUser.registerStep = "age";
      // await savedUser.save();
      await User.findOneAndUpdate(
        { telegramId },
        { registerStep: "age" },
      );

      usersMap.set(telegramId, {
        time: Date.now(),
        user: savedUser,
      });

      try {
        // await ctx.reply("سن خود را انتخاب کنید\n\n⚪️⚪️⚪️⚪️⚪️⚪️⚪️🟢", {
        //   reply_markup: {
        //     keyboard: [...chunkArray(ages, 4)],
        //     resize_keyboard: true,
        //     one_time_keyboard: false,
        //     is_persistent: true,
        //   },
        // });
        await reply(
          ctx,
          next,
          redisClient,
          "سن خود را انتخاب کنید 👇🏻\n\n⚪️⚪️⚪️⚪️⚪️⚪️⚪️🟢",
          [...chunkArray(ages, 4)],
        );
      } catch (error) {
        console.log(error);
        try {
          // await ctx.reply(
          //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
          //     "r5",
          // );
          await reply(
            ctx,
            next,
            redisClient,
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)",
          );
        } catch (e) {}
      }
    } else {
      try {
        // await ctx.reply(
        //   "خطا در انتخاب جنسیت ، لطفا یکی از گزینه های زیر را انتخاب کنید",
        //   {
        //     reply_markup: {
        //       keyboard: [
        //         [
        //           {
        //             text: "خانم 💁‍♀️",
        //           },
        //           {
        //             text: "آقا 🙆‍♂️",
        //           },
        //         ],
        //         [
        //           {
        //             text: "مرحله قبلی",
        //           },
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
          "خطا در انتخاب جنسیت ، لطفا یکی از گزینه های زیر را انتخاب کنید 👇🏻",
          [
            [
              {
                text: "خانم 💁‍♀️",
              },
              {
                text: "آقا 🙆‍♂️",
              },
            ],
            [
              {
                text: "مرحله قبلی",
              },
            ],
          ],
        );
      } catch (error) {
        console.log(error);
        try {
          // await ctx.reply(
          //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
          //     "r5",
          // );
          await reply(
            ctx,
            next,
            redisClient,
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)",
          );
        } catch (e) {}
      }
    }
  }
  if (step === "lookingFor") {
  if (
    ctx?.message?.text === "خانم 💁‍♀️" ||
    ctx?.message?.text === "آقا 🙆‍♂️" ||
    ctx?.message?.text === "فرقی ندارد ⚧️"
  ) {
    // ✅ مستقیم به state میره، genderFilter حذف شد
    savedUser.registerStep = "state";
    savedUser.lookingFor =
      ctx?.message?.text === "خانم 💁‍♀️"
        ? "female"
        : ctx?.message?.text === "آقا 🙆‍♂️"
          ? "male"
          : "noMatter";

    await User.findOneAndUpdate(
      { telegramId },
      { registerStep: "state", lookingFor: savedUser.lookingFor },
    );

    usersMap.set(telegramId, { time: Date.now(), user: savedUser });

    try {
      const showStates = states.map((item) => item.local);
      await reply(
        ctx, next, redisClient,
        "استان خود را انتخاب کنید 🏙️\n\n⚪️⚪️⚪️⚪️🟢🟢🟢🟢",
        [[{ text: "مرحله قبلی" }], ...chunkArray(showStates, 3)],
      );
    } catch (error) {
      await reply(ctx, next, redisClient, "مشکلی پیش آمده است");
    }

  } else if (ctx?.message?.text === "مرحله قبلی") {
    // این بخش تغییری نمیکنه، برمیگرده به gender
    savedUser.registerStep = "gender";
    await User.findOneAndUpdate({ telegramId }, { registerStep: "gender" });
    usersMap.set(telegramId, { time: Date.now(), user: savedUser });

    try {
      await reply(
        ctx, next, redisClient,
        "جنسیت خود را انتخاب کنید\n\n⭕غیرقابل تغییر⭕\n⭕در انتخاب خود دقت کنید⭕\n\n⚪️⚪️⚪️⚪️⚪️⚪️🟢🟢",
        [[{ text: "خانم 💁‍♀️" }, { text: "آقا 🙆‍♂️" }], [{ text: "مرحله قبلی" }]],
      );
    } catch (error) {
      await reply(ctx, next, redisClient, "مشکلی پیش آمده است");
    }

  } else {
    try {
      await reply(
        ctx, next, redisClient,
        "دنبال چه کسی میگردید ؟ 🔎",
        [
          [{ text: "خانم 💁‍♀️" }, { text: "آقا 🙆‍♂️" }, { text: "فرقی ندارد ⚧️" }],
          [{ text: "مرحله قبلی" }],
        ],
      );
    } catch (error) {
      await reply(ctx, next, redisClient, "مشکلی پیش آمده است");
    }
  }
}

  if (step === "state") {
    const findState = states.find(
      (s) => s.local === ctx?.message?.text,
    );

    if (ctx?.message?.text === "مرحله قبلی") {
    // ✅ قبلاً به genderFilter برمیگشت، حالا به lookingFor
    savedUser.registerStep = "lookingFor";
    await User.findOneAndUpdate({ telegramId }, { registerStep: "lookingFor" });
    usersMap.set(telegramId, { time: Date.now(), user: savedUser });

    try {
      await reply(
        ctx, next, redisClient,
        "دنبال چه کسی میگردید ؟ 🔎",
        [
          [{ text: "خانم 💁‍♀️" }, { text: "آقا 🙆‍♂️" }, { text: "فرقی ندارد ⚧️" }],
          [{ text: "مرحله قبلی" }],
        ],
      );
    } catch (error) {
      await reply(ctx, next, redisClient, "مشکلی پیش آمده است");
    }

  } else if (findState) {
      savedUser.registerStep = "name";
      savedUser.state = findState?.english || "";
      // await savedUser.save();

      await User.findOneAndUpdate(
        { telegramId },
        { registerStep: "name", state: savedUser.state },
      );

      usersMap.set(telegramId, {
        time: Date.now(),
        user: savedUser,
      });

      try {
        // await ctx.reply("نام خود را وارد کنید 👇🏻\n\n⚪️⚪️🟢🟢🟢🟢🟢🟢", {
        //   reply_markup: {
        //     keyboard: [
        //       [{ text: telegramName }],
        //       [{ text: "مرحله قبلی" }],
        //     ],
        //     resize_keyboard: true,
        //     one_time_keyboard: false,
        //     is_persistent: true,
        //   },
        // });
        await reply(
          ctx,
          next,
          redisClient,
          "نام خود را وارد کنید 👇🏻\n\n⚪️⚪️🟢🟢🟢🟢🟢🟢",
          [[{ text: telegramName }], [{ text: "مرحله قبلی" }]],
        );
      } catch (error) {
        console.log(error);
        try {
          // await ctx.reply(
          //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
          //     "r5",
          // );
          await reply(
            ctx,
            next,
            redisClient,
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)",
          );
        } catch (e) {}
      }
    } else {
      try {
        const showStates = states.map((item) => item.local);
        // await ctx.reply("شهر خود را انتخاب کنید", {
        //   reply_markup: {
        //     keyboard: [
        //       [{ text: "مرحله قبلی" }],
        //       ...chunkArray(showStates, 3),
        //     ],
        //     resize_keyboard: true,
        //     one_time_keyboard: false,
        //     is_persistent: true,
        //   },
        // });
        await reply(
          ctx,
          next,
          redisClient,
          "استان خود را انتخاب کنید 🏙️\n\n⚪️⚪️⚪️🟢🟢🟢🟢🟢",
          [[{ text: "مرحله قبلی" }], ...chunkArray(showStates, 3)],
        );
      } catch (error) {
        console.log(error);
        try {
          // await ctx.reply(
          //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
          //     "r5",
          // );
          await reply(
            ctx,
            next,
            redisClient,
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)",
          );
        } catch (e) {}
      }
    }
  }
  if (step === "name") {
    if (ctx?.message?.text === "مرحله قبلی") {
      savedUser.registerStep = "state";
      // await savedUser.save();
      await User.findOneAndUpdate(
        { telegramId },
        { registerStep: "state" },
      );

      usersMap.set(telegramId, {
        time: Date.now(),
        user: savedUser,
      });

      try {
        const showStates = states.map((item) => item.local);
        // await ctx.reply("شهر خود را انتخاب کنید", {
        //   reply_markup: {
        //     keyboard: [
        //       [{ text: "مرحله قبلی" }],
        //       ...chunkArray(showStates, 3),
        //     ],
        //     resize_keyboard: true,
        //     one_time_keyboard: false,
        //     is_persistent: true,
        //   },
        // });
        await reply(
          ctx,
          next,
          redisClient,
          "استان خود را انتخاب کنید 🏙️\n\n⚪️⚪️⚪️🟢🟢🟢🟢🟢",
          [[{ text: "مرحله قبلی" }], ...chunkArray(showStates, 3)],
        );
      } catch (error) {
        console.log(error);
        try {
          // await ctx.reply(
          //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
          //     "r5",
          // );
          await reply(
            ctx,
            next,
            redisClient,
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)",
          );
        } catch (e) {}
      }
    } else if (!ctx?.message?.text) {
      savedUser.registerStep = "name";
      // await savedUser.save();
      await User.findOneAndUpdate(
        { telegramId },
        { registerStep: "name" },
      );

      usersMap.set(telegramId, {
        time: Date.now(),
        user: savedUser,
      });

      try {
        await reply(
          ctx,
          next,
          redisClient,
          "نام خود را وارد کنید 👇🏻\n\n⚪️⚪️🟢🟢🟢🟢🟢🟢",
          [[{ text: telegramName }], [{ text: "مرحله قبلی" }]],
        );
      } catch (error) {
        console.log(error);
        try {
          await reply(
            ctx,
            next,
            redisClient,
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)",
          );
        } catch (e) {}
      }
    } else {
      const isBadWord = badWords.some((word) =>
        ctx?.message?.text
          ?.toLowerCase()
          .includes(word.toLowerCase()),
      );
      if (isBadWord) {
        try {
          await reply(
            ctx,
            next,
            redisClient,
            "حاوی کلمات نامناسب ⛔",
          );
        } catch (error) {
          console.log(error);
        }
        return;
      }

      if (containsLinkOrTelegramID(ctx?.message?.text)) {
        await reply(
          ctx,
          next,
          redisClient,
          "نام نمیتواند شامل لینک یا آیدی باشد ⭕",
        );
        return;
      }

      if (ctx?.message?.text?.length > 25) {
        await reply(
          ctx,
          next,
          redisClient,
          "تعداد کاراکتر بیش از حد مجاز است ⭕",
        );
        return;
      }

      // save name
      savedUser.registerStep = "bio";
      savedUser.fullName = ctx?.message?.text;
      // await savedUser.save();

      await User.findOneAndUpdate(
        { telegramId },
        { registerStep: "bio", fullName: savedUser.fullName },
      );

      usersMap.set(telegramId, {
        time: Date.now(),
        user: savedUser,
      });

      try {
        if (
          (savedUser.state === "Tehran" ||
            savedUser.state === "Alborz") &&
          savedUser.gender === "female"
        ) {
          await reply(
            ctx,
            next,
            redisClient,
            `درود ${savedUser.fullName} عزیز \n\n من ابولفضم سازنده ی ربات ، هر سوالی یا مشکلی داشتی میتونی ازم بپرسی 💕 \n\n@abolfazl021mokhtari \n@abolfazl021mokhtari \n@abolfazl021mokhtari`,
          );
        }
      } catch (error) {}

      try {
        await reply(
          ctx,
          next,
          redisClient,
          "درباره خودت بیشتر بگو. دنبال چه کسی می‌گردی؟ می‌خوای چیکار کنی؟ من بهترین مچ‌ها رو پیدا می‌کنم برات\n\n⚪️🟢🟢🟢🟢🟢🟢🟢",
          [
            [
              {
                text: "رد شدن",
              },
            ],
            [{ text: "مرحله قبلی" }],
          ],
        );
        // },
        //   savedUser.state === "Tehran" &&
        //     savedUser.gender === "female"
        //     ? 200
        //     : 0,
        // );
      } catch (error) {
        console.log(error);
        try {
          // await ctx.reply(
          //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
          //     "r5",
          // );
          await reply(
            ctx,
            next,
            redisClient,
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)",
          );
        } catch (e) {}
      }
    }
  }

  if (step === "bio") {
    if (ctx?.message?.text === "مرحله قبلی") {
      savedUser.registerStep = "name";
      // await savedUser.save();
      await User.findOneAndUpdate(
        { telegramId },
        { registerStep: "name" },
      );

      usersMap.set(telegramId, {
        time: Date.now(),
        user: savedUser,
      });

      try {
        // await ctx.reply("نام خود را وارد کنید 👇🏻\n\n⚪️⚪️🟢🟢🟢🟢🟢🟢", {
        //   reply_markup: {
        //     keyboard: [
        //       [{ text: telegramName }],
        //       [{ text: "مرحله قبلی" }],
        //     ],
        //     resize_keyboard: true,
        //     one_time_keyboard: false,
        //     is_persistent: true,
        //   },
        // });
        await reply(
          ctx,
          next,
          redisClient,
          "نام خود را وارد کنید 👇🏻\n\n⚪️⚪️🟢🟢🟢🟢🟢🟢",
          [[{ text: telegramName }], [{ text: "مرحله قبلی" }]],
        );
      } catch (error) {
        console.log(error);
        try {
          // await ctx.reply(
          //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
          //     "r5",
          // );
          await reply(
            ctx,
            next,
            redisClient,
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)",
          );
        } catch (e) {}
      }
    } else if (!ctx?.message?.text || ctx?.message?.text.length < 5) {
      try {
        await reply(
          ctx,
          next,
          redisClient,
          "درباره خودت بیشتر بگو. دنبال چه کسی می‌گردی؟ می‌خوای چیکار کنی؟ من بهترین مچ‌ها رو پیدا می‌کنم برات\n\n⚪️🟢🟢🟢🟢🟢🟢🟢",
          [
            [
              {
                text: "رد شدن",
              },
            ],
            [{ text: "مرحله قبلی" }],
          ],
        );
      } catch (error) {
        console.log(error);
        try {
          // await ctx.reply(
          //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
          //     "r5",
          // );
          await reply(
            ctx,
            next,
            redisClient,
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)",
          );
        } catch (e) {}
      }
    } else {
      // ثبت در کاربران جدید
      const getNewRegistered = await redisClient.get("newRegister");
      const newRegister = getNewRegistered
        ? JSON.parse(getNewRegistered)
        : [];
      if (!newRegister.find((f) => f == +telegramId)) {
        newRegister.push(+telegramId);
      }
      await redisClient.set(
        "newRegister",
        JSON.stringify(newRegister),
      );

      const isBadWord = badWords.some((word) =>
        ctx?.message?.text
          ?.toLowerCase()
          .includes(word.toLowerCase()),
      );
      if (isBadWord) {
        try {
          // await ctx.reply("شامل کلمات نامناسب");
          await reply(ctx, next, redisClient, "شامل کلمات نامناسب");
        } catch (error) {
          console.log(error);
        }
        return;
      }

      if (containsLinkOrTelegramID(ctx?.message?.text)) {
        await reply(
          ctx,
          next,
          redisClient,
          "بیوگرافی نمیتواند شامل لینک یا آیدی باشد ⭕",
        );
        return;
      }

      if (ctx?.message?.text?.length > 250) {
        await reply(
          ctx,
          next,
          redisClient,
          "تعداد کاراکتر بیش از حد مجاز است ⭕",
        );
        return;
      }

      // save bio

      savedUser.registerStep = "photo";
      savedUser.bio =
        ctx?.message?.text !== "رد شدن" ? ctx?.message?.text : "";
      // await savedUser.save();
      await User.findOneAndUpdate(
        { telegramId },
        {
          registerStep: "photo",
          bio: savedUser?.bio ?? "",
        },
      );

      usersMap.set(telegramId, {
        time: Date.now(),
        user: savedUser,
      });

      try {
        // await ctx.reply("یک تصویر برای پروفایل خود ارسال کنید 🖼️\n\n🟢🟢🟢🟢🟢🟢🟢🟢", {
        //   reply_markup: {
        //     keyboard: [
        //       [
        //         {
        //           text: "مرحله قبلی",
        //         },
        //       ],
        //     ],
        //     resize_keyboard: true,
        //     one_time_keyboard: false,
        //     is_persistent: true,
        //   },
        // });
        await reply(
          ctx,
          next,
          redisClient,
          "یک تصویر برای پروفایل خود ارسال کنید 🖼️\n\n🟢🟢🟢🟢🟢🟢🟢🟢",
          [
            [
              {
                text: "مرحله قبلی",
              },
            ],
          ],
        );
      } catch (error) {
        console.log(error);
        try {
          // await ctx.reply(
          //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
          //     "r5",
          // );
          await reply(
            ctx,
            next,
            redisClient,
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)",
          );
        } catch (e) {}
      }
    }
  }
  if (step === "photo") {
    if (ctx?.message?.text === "مرحله قبلی") {
      savedUser.registerStep = "bio";
      // await savedUser.save();
      await User.findOneAndUpdate(
        { telegramId },
        { registerStep: "bio" },
      );

      usersMap.set(telegramId, {
        time: Date.now(),
        user: savedUser,
      });

      try {
        await reply(
          ctx,
          next,
          redisClient,
          "درباره خودت بیشتر بگو. دنبال چه کسی می‌گردی؟ می‌خوای چیکار کنی؟ من بهترین مچ‌ها رو پیدا می‌کنم برات\n\n⚪️🟢🟢🟢🟢🟢🟢🟢",
          [
            [
              {
                text: "رد شدن",
              },
            ],
            [{ text: "مرحله قبلی" }],
          ],
        );
      } catch (error) {
        console.log(error);
        try {
          // await ctx.reply(
          //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
          //     "r5",
          // );
          await reply(
            ctx,
            next,
            redisClient,
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)",
          );
        } catch (e) {}
      }
    } else if (ctx.message.photo) {
      // console.log("photooo");
      try {
        const photos = savedUser.profileImages || [];
        if (photos.length === 3) return;
        try {
          // await ctx.reply("⌛️");
          await reply(ctx, next, redisClient, "⌛️");
        } catch (error) {}

        const fileId = ctx.message.photo.at(-1).file_id;
        const fileLink = await ctx.telegram.getFileLink(fileId);
        try {
          const filee = await ctx.message.photo.at(-1);
          // console.log({ filee });
        } catch (error) {}

        const imageUrl = await uploadImageFromUrl(fileLink);
        // console.log("2222");
        if (photos.length === 3) return;
        photos.push(imageUrl);
        await Pictures.create({
          telegramId: +telegramId || savedUser.telegramId || 0,
          fullName: savedUser.fullName || "",
          bio: savedUser?.bio || "",
          url: imageUrl,
        });

        savedUser.profileImages = [imageUrl];
        // await savedUser.save();
        await User.findOneAndUpdate(
          { telegramId },
          {
            registerStep: "photo",
            profileImages: savedUser.profileImages,
          },
        );

        usersMap.set(telegramId, {
          time: Date.now(),
          user: savedUser,
        });

        // if (photos.length === 1) {
        //   ctx.reply("عکس اضافه شد - 1 از 3. یکی بیشتر؟", {
        //     reply_markup: {
        //       keyboard: [
        //         [
        //           {
        //             text: "تمام ، ذخیره تصاویر ✅",
        //           },
        //         ],
        //       ],
        //       resize_keyboard: true,
        //       one_time_keyboard: false,
        //       is_persistent: true,
        //     },
        //   });
        // } else if (photos.length === 2) {
        //   ctx.reply("عکس اضافه شد - 2 از 3. یکی بیشتر؟", {
        //     reply_markup: {
        //       keyboard: [
        //         [
        //           {
        //             text: "تمام ، ذخیره تصاویر ✅",
        //           },
        //         ],
        //       ],
        //       resize_keyboard: true,
        //       one_time_keyboard: false,
        //       is_persistent: true,
        //     },
        //   });
        // } else {
        savedUser.registerStep = "isCorrectProfile";
        // await savedUser.save();
        await User.findOneAndUpdate(
          { telegramId },
          { registerStep: "isCorrectProfile" },
        );

        usersMap.set(telegramId, {
          time: Date.now(),
          user: savedUser,
        });

        // setTimeout(async () => {
        // const photos = savedUser.profileImages;
        const fullName = savedUser.fullName;
        const age = savedUser.age;
        const state = savedUser.state;
        const bio = savedUser?.bio ?? "";

        try {
          await ctx.replyWithPhoto(savedUser.profileImages[0], {
            caption: `${fullName}, ${age}, ${state} ${
              bio ? "\n" + bio : ""
            } `,
          });
        } catch (error) {
          console.log(error);
          try {
            // await ctx.reply(
            //   `${fullName}, ${age}, ${state} ${
            //     bio ? "\n" + bio : ""
            //   } `,
            // );
            await reply(
              ctx,
              next,
              redisClient,
              `${fullName}, ${age}, ${state} ${
                bio ? "\n" + bio : ""
              } `,
            );
          } catch (error) {
            console.log(error);
          }
        }

        try {
          await reply(ctx, next, redisClient, "درسته ؟", [
            [{ text: "بله" }, { text: "ویرایش پروفایلم" }],
          ]);
        } catch (error) {}
        return;
      } catch (error) {
        console.log(error);
        try {
          await reply(
            ctx,
            next,
            redisClient,
            "تصویر پروفایل شما ثبت نشد 🙁 . اینترنت ضعیف است لطفا بعدا یک تصویر برای پروفایل خود قرار دهید .",
          );
          savedUser.registerStep = "isCorrectProfile";
          // await savedUser.save();
          await User.findOneAndUpdate(
            { telegramId },
            { registerStep: "isCorrectProfile" },
          );

          usersMap.set(telegramId, {
            time: Date.now(),
            user: savedUser,
          });

          // setTimeout(async () => {
          // const photos = savedUser.profileImages;
          const fullName = savedUser.fullName;
          const age = savedUser.age;
          const state = savedUser.state;
          const bio = savedUser?.bio ?? "";

          try {
            await ctx.replyWithPhoto(savedUser.profileImages[0], {
              caption: `${fullName}, ${age}, ${state} ${
                bio ? "\n" + bio : ""
              } `,
            });
          } catch (error) {
            console.log(error);
            try {
              await reply(
                ctx,
                next,
                redisClient,
                `${fullName}, ${age}, ${state} ${
                  bio ? "\n" + bio : ""
                } `,
              );
            } catch (error) {
              console.log(error);
            }
          }

          try {
            await reply(ctx, next, redisClient, "درسته ؟", [
              [{ text: "بله" }, { text: "ویرایش پروفایلم" }],
            ]);
          } catch (error) {}
        } catch (e) {}
        // console.log({ error });
      }
    } else {
      savedUser.step = "photo";
      // await savedUser.save();
      await User.findOneAndUpdate(
        { telegramId },
        { registerStep: "photo" },
      );

      usersMap.set(telegramId, {
        time: Date.now(),
        user: savedUser,
      });

      try {
        await reply(
          ctx,
          next,
          redisClient,
          "یک تصویر برای پروفایل خود ارسال کنید 🖼️\n\n🟢🟢🟢🟢🟢🟢🟢🟢",
          [[{ text: "مرحله قبلی" }]],
        );
      } catch (error) {
        console.log(error);
        try {
          await reply(
            ctx,
            next,
            redisClient,
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)",
          );
        } catch (e) {}
      }
    }
  }
  if (step === "isCorrectProfile") {
    if (ctx?.message?.text === "بله") {
      const age = savedUser.age;
      const gender = savedUser.gender;
      const lookingFor = savedUser.lookingFor;
      const state = savedUser.state;
      const name = savedUser.fullName;
      const bio = savedUser?.bio ?? "";
      const profileImages = savedUser.profileImages;

      activeUsersQueue.add({ telegramId });

      // ست کردن کاربران اولیه در forYou
      const getData = await redisClient.getBuffer(
        `city:${lookingFor.toLowerCase()}:${state.toLowerCase()}`,
      );

      if (Buffer.isBuffer(getData)) {
        // const userRoot = await protobuf.load(
        //   "./protoBuf_files/foryou.proto",
        // );

        // let ActiveUsersProto = userRoot.lookupType("Users");
        const decodedMessage = ActiveUsersProto.decode(getData);
        let usersArrayFromRedis = decodedMessage.users || [];
        if (usersArrayFromRedis.length < 100) {
          const getDataGlobal = await redisClient.getBuffer(
            `globalUsers:${lookingFor.toLowerCase()}`,
          );
          if (Buffer.isBuffer(getDataGlobal)) {
            const decodedMessage2 = ActiveUsersProto.decode(getData);
            const result = Array.from(
              new Map(
                [
                  ...usersArrayFromRedis,
                  ...decodedMessage2.users,
                ].map((item) => [item.telegramId, item]),
              ).values(),
            );
            usersArrayFromRedis = result || [];
          }
        } else {
        }
        forYouList.set(telegramId, usersArrayFromRedis);
        // console.log({ usersArrayFromRedis });
      }

      if (age && gender && lookingFor && state && name) {
        try {
          // save in redis
          await redisClient.hmset(`user:${savedUser.telegramId}`, {
            lastUpdate: Date.now(),
            lastSeen: Date.now(),
            createAt: Date.now(),
            age: age.toString(),
            gender,
            lookingFor,
            state,
            fullName: name,
            bio,
            profileImages: JSON.stringify(profileImages),
            sleep: false,
          });

          savedUser.userStep = "search";
          // await savedUser.save();
          await User.findOneAndUpdate(
            { telegramId },
            { userStep: "search" },
          );

          usersMap.set(telegramId, {
            time: Date.now(),
            user: savedUser,
          });

          // ctx.reply("🔍", {
          //   reply_markup: {
          //     keyboard: [
          //       [
          //         { text: "💌" },
          //         { text: "❌" },
          //         { text: "❤️" },
          //         { text: "☰" },
          //       ],
          //     ],
          //    resize_keyboard: true,
          // one_time_keyboard: false,
          // is_persistent: true,
          //   },
          // });

          // ctx.replyWithPhoto(
          //   "https://pouns-storage.storage.c2.liara.space/1758644004701-4a0b00d2-f844-4e63-9923-2e3ba0de688c.jpg",
          //   {
          //     caption: "Abolfazl, 25, 🇮🇷 Tehran\njust a programmer",
          //   },
          // );

          try {
            savedUser.userStep = "search";
            usersMap.set(telegramId, {
              time: Date.now(),
              user: savedUser,
            });
            if (
              forYouList.get(telegramId) &&
              Array.isArray(forYouList.get(telegramId)) &&
              forYouList.get(telegramId).length > 10 &&
              forYouTime.get(telegramId) &&
              forYouTime.get(telegramId) + 300000 > Date.now()
            ) {
              try {
                await reply(
                  ctx,
                  next,
                  redisClient,
                  "❤️ : لایک\n❌ : رد کردن\n💌 : لایک به همراه پیام\n☰ : منو\n\nوقتی کاربری را لایک میکنید ، لایک شما برای او ارسال میشود و اگر اوهم شما را لایک کند ، متصل میشوید .",
                  [
                    [
                      { text: "☰" },
                      { text: "❤️" },
                      { text: "❌" },
                      { text: "💌" },
                    ],
                  ],
                );
              } catch (error) {}

              const { fullName, age, state, bio, profileImages } =
                forYouList.get(telegramId)[0];

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
                    } `,
                  },
                );
              } catch (error) {
                try {
                  // await ctx.reply(
                  //   `${fullName}, ${age}, ${state} ${
                  //     bio ? "\n" + bio : ""
                  //   } `,
                  // );
                  await reply(
                    ctx,
                    next,
                    redisClient,
                    `${fullName}, ${age}, ${state} ${
                      bio ? "\n" + bio : ""
                    } `,
                  );
                } catch (error) {
                  console.log(error);
                }
              }

              // const photos = existingUser.profileImages || [];
              // await ctx.replyWithMediaGroup(
              //   photos.map((photo, index) => ({
              //     type: "photo",
              //     media: photo,
              //     caption:
              //       index === 0
              //         ? `${fullName}, ${age}, ${state} ${
              //             bio ? "\n" + bio : ""
              //           } `
              //         : undefined,
              //   })),
              // );
            } else {
              forYouTime.set(telegramId, Date.now());

              const userSavedd = await User.findOne({ telegramId });
              requestToFillSuggestQueue.add({
                telegramId,
                user: userSavedd,
              });

              // setTimeout(async () => {
              try {
                const { fullName, age, state, bio, profileImages } =
                  forYouList.get(telegramId)[0];
                await reply(
                  ctx,
                  next,
                  redisClient,
                  "❤️ : لایک\n❌ : رد کردن\n💌 : لایک به همراه پیام\n☰ : منو\n\nوقتی کاربری را لایک میکنید ، لایک شما برای او ارسال میشود و اگر اوهم شما را لایک کند ، متصل میشوید .",
                  [
                    [
                      { text: "☰" },
                      { text: "❤️" },
                      { text: "❌" },
                      { text: "💌" },
                    ],
                  ],
                );
                const photos = profileImages;

                try {
                  await ctx.replyWithPhoto(photos[0], {
                    caption: `${fullName}, ${age}, ${state} ${
                      bio ? "\n" + bio : ""
                    } `,
                  });
                } catch (error) {
                  try {
                    await reply(
                      ctx,
                      next,
                      redisClient,
                      `${fullName}, ${age}, ${state} ${
                        bio ? "\n" + bio : ""
                      } `,
                    );
                  } catch (error) {
                    console.log(error);
                  }
                }
              } catch (error) {
                console.log({ error });
              }
              // }, 3000);
            }
          } catch (error) {
            console.log({ error });
          }
        } catch (error) {
          console.log(error);
          try {
            // await ctx.reply(
            //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
            //     "r5",
            // );
            await reply(
              ctx,
              next,
              redisClient,
              "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)",
            );
          } catch (e) {}
        }
      } else {
        console.log(error);
        try {
          // await ctx.reply(
          //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
          //     "r5",
          // );
          await reply(
            ctx,
            next,
            redisClient,
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)",
          );
        } catch (e) {}
      }
    } else if (ctx?.message?.text === "ویرایش پروفایلم") {
      await User.findOneAndUpdate(
        { telegramId },
        { userStep: "editProfileMenu" },
      );

      savedUser.userStep = "editProfileMenu";
      // await savedUser.save();
      // await User.findOneAndUpdate(
      //   { telegramId },
      //   { registerStep: "editProfileMenu" },
      // );

      usersMap.set(telegramId, {
        time: Date.now(),
        user: savedUser,
      });

      try {
        // await ctx.reply(
        //   `1. ${"مشاهده پروفایل ها"} \n2. ${"ویرایش پروفایلم"} \n3. ${"تغییر عکس من"}`,
        //   {
        //     reply_markup: {
        //       keyboard: [
        //         [{ text: "1🚀" }, { text: "2" }, { text: "3" }],
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
          `1. ${"مشاهده پروفایل ها"} \n2. ${"ویرایش پروفایلم"} \n3. ${"تغییر عکس من"}`,
          [[{ text: "1🚀" }, { text: "2" }, { text: "3" }]],
        );
      } catch (error) {
        console.log(error);
      }
    } else {
      const photos = savedUser.profileImages || [];
      const fullName = savedUser.fullName;
      const age = savedUser.age;
      const state = savedUser.state;
      const bio = savedUser?.bio ?? "";

      try {
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
              } `,
            },
          );
        } catch (error) {
          try {
            // await ctx.reply(
            //   `${fullName}, ${age}, ${state} ${
            //     bio ? "\n" + bio : ""
            //   } `,
            // );
            await reply(
              ctx,
              next,
              redisClient,
              `${fullName}, ${age}, ${state} ${
                bio ? "\n" + bio : ""
              } `,
            );
          } catch (error) {
            console.log(error);
          }
        }

        // await ctx.reply("درسته ؟", {
        //   reply_markup: {
        //     keyboard: [
        //       [{ text: "بله" }, { text: "ویرایش پروفایلم" }],
        //     ],
        //     resize_keyboard: true,
        //     one_time_keyboard: false,
        //     is_persistent: true,
        //   },
        // });
        await reply(ctx, next, redisClient, "درسته ؟", [
          [{ text: "بله" }, { text: "ویرایش پروفایلم" }],
        ]);
      } catch (error) {
        console.log(error);
        try {
          // await ctx.reply(
          //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
          //     "r5",
          // );
          await reply(
            ctx,
            next,
            redisClient,
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)",
          );
        } catch (e) {}
      }

      return;
    }
  }
};

module.exports = {
  registerInBot,
};
