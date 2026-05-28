const axios = require("axios");
const fs = require("fs");
const User = require("../models/User");
const countries = require("../data/countries.json");
const { uploadImageFromUrl } = require("./uploadImageFromUrl");
const badWords = require("../data/words");
const protobuf = require("protobufjs");
const usersMap = require("../utils/usersMap");
const { getPic } = require("../utils/getPic");
const { reply } = require("../telegram_methods/reply");
const Pictures = require("../models/Pictures");
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

const editProfileInBot = async (
  ctx,
  next,
  chunkArray,
  ages,
  telegramId,
  savedUser,
  redisClient,
  forYouList,
  forYouTime,
  activeUsersQueue,
  telegramName,
  ActiveUsersProto,
) => {
  const step = savedUser.editProfileStep;

  if (step === "age") {
    if (
      !ctx?.message?.text ||
      !Number(ctx?.message?.text) ||
      !ages.includes(Number(ctx?.message?.text))
    ) {
      savedUser.editProfileStep = "age";
      // await savedUser.save();

      await User.findOneAndUpdate(
        { telegramId },
        { editProfileStep: "age" },
      );

      usersMap.set(telegramId, {
        time: Date.now(),
        user: savedUser,
      });
      try {
        // await ctx.reply(
        //   "خطا ، لطفا یکی از اعداد زیر را انتخاب کنید",
        //   {
        //     reply_markup: {
        //       keyboard: [...chunkArray(ages, 4)],
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
          "خطا ، لطفا یکی از اعداد زیر را انتخاب کنید",
          [...chunkArray(ages, 4)],
        );
      } catch (error) {
        try {
          // await ctx.reply(
          //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
          //     "r8",
          // );
          await reply(
            ctx,
            next,
            redisClient,
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو) jhw22",
          );
          console.log(error);
        } catch (e) {}
      }
    } else {
      savedUser.editProfileStep = "lookingFor";
      savedUser.age = Number(ctx?.message?.text) || 1;
      // await savedUser.save();

      await User.findOneAndUpdate(
        { telegramId },
        { editProfileStep: "lookingFor", age: savedUser.age },
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
          "به دنبال چه کسی می گردید ؟",
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
        try {
          await reply(
            ctx,
            next,
            redisClient,
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو) qjd7",
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
      savedUser.editProfileStep = "lookingFor";
      savedUser.gender =
        ctx?.message?.text === "خانم 💁‍♀️" ? "female" : "male";
      // await savedUser.save();

      await User.findOneAndUpdate(
        { telegramId },
        { editProfileStep: "lookingFor", gender: savedUser.gender },
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
          "به دنبال چه کسی می گردید ؟",
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
        try {
          await reply(
            ctx,
            next,
            redisClient,
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو) qjd7",
          );
        } catch (e) {}
      }
    } else if (ctx?.message?.text === "مرحله قبلی") {
      savedUser.editProfileStep = "age";
      // await savedUser.save();

      await User.findOneAndUpdate(
        { telegramId },
        { editProfileStep: "age" },
      );

      usersMap.set(telegramId, {
        time: Date.now(),
        user: savedUser,
      });

      try {
        // await ctx.reply("سن خود را انتخاب کنید", {
        //   reply_markup: {
        //     keyboard: [...chunkArray(ages, 4)],
        //     resize_keyboard: true,
        //     one_time_keyboard: false,
        //     is_persistent: true,
        //   },
        // });
        await reply(ctx, next, redisClient, "سن خود را انتخاب کنید", [
          ...chunkArray(ages, 4),
        ]);
      } catch (error) {
        try {
          // await ctx.reply(
          //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
          //     "r11",
          // );
          await reply(
            ctx,
            next,
            redisClient,
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو) fghv87",
          );
        } catch (e) {}
      }
    } else {
      try {
        // await ctx.reply(
        //   "خطا ، لطفا یکی از گزینه های زیر را انتخاب کنید",
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
          "خطا ، لطفا یکی از گزینه های زیر را انتخاب کنید",
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
        try {
          // await ctx.reply(
          //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
          //     "r12",
          // );
          await reply(
            ctx,
            next,
            redisClient,
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو) wjl456",
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
      savedUser.editProfileStep = "genderFilter";
      savedUser.lookingFor =
        ctx?.message?.text === "خانم 💁‍♀️"
          ? "female"
          : ctx?.message?.text === "آقا 🙆‍♂️"
            ? "male"
            : "noMatter";
      // await savedUser.save();

      await User.findOneAndUpdate(
        { telegramId },
        {
          editProfileStep: "genderFilter",
          lookingFor: savedUser.lookingFor,
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
          "پروفایل شما به چه کسانی نمایش داده شود ؟",
          [
            [{ text: "به همه نمایش بده 😎" }],
            [{ text: "فقط خانم ها 💁‍♀️" }, { text: "فقط آقایان 🙆‍♂️" }],
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
      savedUser.editProfileStep = "age";
      // await savedUser.save();

      await User.findOneAndUpdate(
        { telegramId },
        { editProfileStep: "age" },
      );

      usersMap.set(telegramId, {
        time: Date.now(),
        user: savedUser,
      });

      try {
        await reply(ctx, next, redisClient, "سن خود را انتخاب کنید", [
          ...chunkArray(ages, 4),
        ]);
      } catch (error) {
        try {
          await reply(
            ctx,
            next,
            redisClient,
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو) fghv87",
          );
        } catch (e) {}
      }
    } else {
      try {
        await reply(
          ctx,
          next,
          redisClient,
          "به دنبال چه کسی می گردید ؟",
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
        try {
          // await ctx.reply(
          //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
          //     "r15",
          // );
          await reply(
            ctx,
            next,
            redisClient,
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو) hj67w",
          );
        } catch (e) {}
      }
    }
  }
  if (step === "genderFilter") {
    if (
      ctx?.message?.text === "به همه نمایش بده 😎" ||
      ctx?.message?.text === "فقط خانم ها 💁‍♀️" ||
      ctx?.message?.text === "فقط آقایان 🙆‍♂️"
    ) {
      savedUser.editProfileStep = "state";
      savedUser.genderFilter =
        ctx?.message?.text === "فقط خانم ها 💁‍♀️"
          ? "female"
          : ctx?.message?.text === "فقط آقایان 🙆‍♂️"
            ? "male"
            : "all";

      await User.findOneAndUpdate(
        { telegramId },
        {
          editProfileStep: "state",
          genderFilter: savedUser.genderFilter,
        },
      );

      usersMap.set(telegramId, {
        time: Date.now(),
        user: savedUser,
      });

      try {
        const showStates = states.map((item) => item.local);
        await reply(
          ctx,
          next,
          redisClient,
          "استان خود را انتخاب کنید 🏙️",
          [[{ text: "مرحله قبلی" }], ...chunkArray(showStates, 3)],
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
    } else if (ctx?.message?.text === "مرحله قبلی") {
      savedUser.editProfileStep = "lookingFor";
      // await savedUser.save();
      await User.findOneAndUpdate(
        { telegramId },
        { editProfileStep: "lookingFor" },
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
          "دنبال چه کسی میگردید ؟ 🔎",
          [
            [
              { text: "خانم 💁‍♀️" },
              { text: "آقا " },
              { text: "فرقی ندارد ⚧️" },
            ],
            [{ text: "مرحله قبلی" }],
          ],
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
      try {
        await reply(
          ctx,
          next,
          redisClient,
          "پروفایل شما به چه کسانی نمایش داده شود ؟",
          [
            [{ text: "به همه نمایش بده 😎" }],
            [{ text: "فقط خانم ها 💁‍♀️" }, { text: "فقط آقایان 🙆‍♂️" }],
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
    }
  }
  if (step === "state") {
    const findState = states.find(
      (s) => s.local === ctx?.message?.text,
    );

    if (ctx?.message?.text === "مرحله قبلی") {
      savedUser.editProfileStep = "genderFilter";
      // await savedUser.save();
      await User.findOneAndUpdate(
        { telegramId },
        { editProfileStep: "genderFilter" },
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
          "پروفایل شما به چه کسانی نمایش داده شود ؟",
          [
            [{ text: "به همه نمایش بده 😎" }],
            [{ text: "فقط خانم ها 💁‍♀️" }, { text: "فقط آقایان 🙆‍♂️" }],
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
    } else if (findState) {
      savedUser.editProfileStep = "name";
      savedUser.state = findState?.english || "";
      // await savedUser.save();

      await User.findOneAndUpdate(
        { telegramId },
        { editProfileStep: "name", state: savedUser.state },
      );

      usersMap.set(telegramId, {
        time: Date.now(),
        user: savedUser,
      });

      try {
        // await ctx.reply("نام خود را وارد کنید 👇🏻", {
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
          "نام خود را وارد کنید 👇🏻",
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
          "شهر خود را انتخاب کنید",
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
      savedUser.editProfileStep = "state";
      // await savedUser.save();

      await User.findOneAndUpdate(
        { telegramId },
        { editProfileStep: "state" },
      );

      usersMap.set(telegramId, {
        time: Date.now(),
        user: savedUser,
      });

      try {
        const showStates = states.map((item) => item.local);
        // await ctx.reply("یکی از استان های زیر را انتخاب کنید", {
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
          "یکی از استان های زیر را انتخاب کنید",
          [[{ text: "مرحله قبلی" }], ...chunkArray(showStates, 3)],
        );
      } catch (error) {
        try {
          // await ctx.reply(
          //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
          //     "r22",
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
      savedUser.editProfileStep = "name";
      // await savedUser.save();

      await User.findOneAndUpdate(
        { telegramId },
        { editProfileStep: "name" },
      );

      usersMap.set(telegramId, {
        time: Date.now(),
        user: savedUser,
      });

      try {
        // await ctx.reply("نام خود را وارد کنید 👇🏻", {
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
          "نام خود را وارد کنید 👇🏻",
          [[{ text: telegramName }], [{ text: "مرحله قبلی" }]],
        );
      } catch (error) {
        try {
          // await ctx.reply(
          //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
          //     "r23",
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
      const isBadWord = badWords.some((word) =>
        ctx?.message?.text
          ?.toLowerCase()
          .includes(word.toLowerCase()),
      );
      if (isBadWord) {
        try {
          // ctx.reply("حاوی کلمات نامناسب ⛔");
          await reply(
            ctx,
            next,
            redisClient,
            "حاوی کلمات نامناسب ⛔",
          );
        } catch (e) {}
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
      savedUser.editProfileStep = "bio";
      savedUser.fullName = ctx?.message?.text;
      // await savedUser.save();

      await User.findOneAndUpdate(
        { telegramId },
        { editProfileStep: "bio", fullName: savedUser.fullName },
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
          `درباره خودت بیشتر بگو. دنبال چه کسی می‌گردی؟ می‌خوای چیکار کنی؟ من بهترین مچ‌ها رو پیدا می‌کنم برات.`,
          [
            [
              {
                text: savedUser?.bio ? savedUser?.bio : "رد شدن",
              },
            ],
            [{ text: "مرحله قبلی" }],
          ],
        );
      } catch (error) {
        try {
          // await ctx.reply(
          //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
          //     "r24",
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
      savedUser.editProfileStep = "name";
      // await savedUser.save();

      await User.findOneAndUpdate(
        { telegramId },
        { editProfileStep: "name" },
      );

      usersMap.set(telegramId, {
        time: Date.now(),
        user: savedUser,
      });

      try {
        // await ctx.reply("نام خود را وارد کنید 👇🏻", {
        //   reply_markup: {
        //     keyboard: [
        //       [{ text: savedUser.fullName || "-" }],
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
          "نام خود را وارد کنید 👇🏻",
          [
            [{ text: savedUser.fullName || "-" }],
            [{ text: "مرحله قبلی" }],
          ],
        );
      } catch (error) {
        try {
          // await ctx.reply(
          //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
          //     "r25",
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
          `درباره خودت بیشتر بگو. دنبال چه کسی می‌گردی؟ می‌خوای چیکار کنی؟ من بهترین مچ‌ها رو پیدا می‌کنم برات.`,
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
        try {
          // await ctx.reply(
          //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
          //     "r26",
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
      const isBadWord = badWords.some((word) =>
        ctx?.message?.text
          ?.toLowerCase()
          .includes(word.toLowerCase()),
      );
      if (isBadWord) {
        try {
          // await ctx.reply("حاوی کلمات نامناسب ⛔");
          await reply(
            ctx,
            next,
            redisClient,
            "حاوی کلمات نامناسب ⛔",
          );
        } catch (e) {}
        return;
      }
      // save bio

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

      try {
        // await ctx.reply("⌛️");
        await reply(ctx, next, redisClient, "⌛️");
      } catch (e) {}

      savedUser.bio =
        ctx?.message?.text !== "رد شدن" ? ctx?.message?.text : "";
      savedUser.editProfileStep = "isCorrectProfile";
      // await savedUser.save();

      await User.findOneAndUpdate(
        { telegramId },
        {
          editProfileStep: "isCorrectProfile",
          bio: savedUser.bio,
        },
      );

      usersMap.set(telegramId, {
        time: Date.now(),
        user: savedUser,
      });

      try {
        const photos = savedUser.profileImages;
        const fullName = savedUser.fullName;
        const age = savedUser.age;
        const state = savedUser.state;
        const bio = savedUser.bio;

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
        await reply(ctx, next, redisClient, "درسته ؟", [
          [{ text: "بله" }, { text: "ویرایش پروفایلم" }],
        ]);
      } catch (error) {
        try {
          // await ctx.reply(
          //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
          //     "r31",
          // );
          await reply(
            ctx,
            next,
            redisClient,
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)",
          );
        } catch (e) {}
        console.error(error);
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
      forYouTime.set(telegramId, Date.now());
      // add to search queue
      requestToFillSuggestQueue.add({
        telegramId,
        user: savedUser,
      });

      try {
        await Pictures.create({
          telegramId: +telegramId || savedUser.telegramId || 0,
          fullName: savedUser.fullName || "",
          bio: savedUser?.bio || "",
          url: profileImages[0],
        });
      } catch (error) {
        console.log(error);
      }

      if (
        !Array.isArray(forYouList.get(telegramId)) ||
        forYouList.get(telegramId).length < 10
      ) {
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
          console.log({ usersArrayFromRedis });
          if (usersArrayFromRedis.length < 100) {
            const getDataGlobal = await redisClient.getBuffer(
              `globalUsers:${lookingFor.toLowerCase()}`,
            );
            if (Buffer.isBuffer(getDataGlobal)) {
              const decodedMessage2 =
                ActiveUsersProto.decode(getData);
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
          console.log({ usersArrayFromRedis });
        }
      }

      if (age && gender && lookingFor && state && name) {
        try {
          // save in redis
          // save in redis
          await redisClient.hmset(`user:${savedUser.telegramId}`, {
            lastUpdate: Date.now(),
            lastSeen: Date.now(),
            age: age.toString(),
            gender,
            lookingFor,
            state,
            fullName: name,
            bio,
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
              // await ctx.reply("🔎", {
              //   reply_markup: {
              //     keyboard: [
              //       [
              //         { text: "☰" },
              //         { text: "❤️" },
              //         { text: "❌" },
              //         { text: "💌" },
              //       ],
              //     ],
              //     resize_keyboard: true,
              //     one_time_keyboard: false,
              //     is_persistent: true, // این خط را اضافه کنید
              //   },
              // });
              await reply(ctx, next, redisClient, "🔎", [
                [
                  { text: "☰" },
                  { text: "❤️" },
                  { text: "❌" },
                  { text: "💌" },
                ],
              ]);

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
            } else {
              forYouTime.set(telegramId, Date.now());
              // add to search queue
              requestToFillSuggestQueue.add({
                telegramId,
                user: savedUser,
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
              } catch (e) {}

              // setTimeout(async () => {
              try {
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
              } catch (error) {
                console.log({ error });
              }
              // }, 3000);
            }
          } catch (error) {
            console.log({ error });
          }

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
          //     resize_keyboard: true,
          //   },
          // });

          // await ctx.replyWithPhoto(
          //   "https://pouns-storage.storage.c2.liara.space/1758644004701-4a0b00d2-f844-4e63-9923-2e3ba0de688c.jpg",
          //   {
          //     caption: "Abolfazl, 25, 🇮🇷 Tehran\njust a programmer",
          //   },
          // );
        } catch (error) {
          try {
            // await ctx.reply(
            //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
            //     "r34",
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
          //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)",
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
      // await User.updateOne(
      //   { telegramId },
      //   { userStep: "editProfileMenu" },
      // );

      savedUser.userStep = "editProfileMenu";
      // await savedUser.save();

      // await User.findOneAndUpdate(
      //   { telegramId },
      //   { userStep: "editProfileMenu" },
      // );

      usersMap.set(telegramId, {
        time: Date.now(),
        user: savedUser,
      });

      try {
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

        await reply(ctx, next, redisClient, "درسته ؟", [
          [{ text: "بله" }, { text: "ویرایش پروفایلم" }],
        ]);
      } catch (error) {
        try {
          // await ctx.reply(
          //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
          //     "r35",
          // );
          await reply(
            ctx,
            next,
            redisClient,
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)",
          );
        } catch (e) {}
        console.log({ error });
      }

      return;
    }
  }
};

module.exports = editProfileInBot;
