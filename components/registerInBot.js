const axios = require("axios");
const User = require("../models/User");
const countries = require("../data/countries.json");
const { uploadImageFromUrl } = require("./uploadImageFromUrl");
const badWords = require("../data/words");
const protobuf = require("protobufjs");
const usersMap = require("../utils/usersMap");
const Pictures = require("../models/Pictures");
const fs = require("fs");

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
  langsTextShow,
  ages,
  countriesTextShow,
  texts,
  chunkArray,
  telegramId,
  languages,
  telegramName,
  savedUser,
  redisClient,
  forYouList,
  forYouTime,
  suggestQueue,
  foryouQueue,
) => {
  if (!telegramId) return ctx.reply("مشکلی پیش آمده است");

  const step = savedUser.registerStep;
  console.log({ step });

  if (step === "welcomeMessage" || !step) {
    console.log(ctx?.message?.text);
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
        ctx.reply(
          `همین حالا هزاران نفر در پونس مچ همدیگه رو پیدا می‌کنن 😉 \n\nمن بهت کمک می‌کنم که یه دوست پیدا کنی 👫`,
          {
            reply_markup: {
              keyboard: [[{ text: "بزن بریم 🚀" }]],
              resize_keyboard: true,
              one_time_keyboard: false,
              is_persistent: true,
            },
          },
        );
      } catch (error) {
        ctx.reply(
          "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
            "r5",
        );
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
        ctx.reply("سن خود را انتخاب کنید", {
          reply_markup: {
            keyboard: [...chunkArray(ages, 4)],
            resize_keyboard: true,
            one_time_keyboard: false,
            is_persistent: true,
          },
        });
      } catch (error) {
        ctx.reply(
          "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
            "r6",
        );
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
        ctx.reply("خطا در انتخاب سن", {
          reply_markup: {
            keyboard: [...chunkArray(ages, 4)],
            resize_keyboard: true,
            one_time_keyboard: false,
            is_persistent: true,
          },
        });
      } catch (error) {
        ctx.reply(+"r8");
      }
    } else {
      ("مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)");
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

      // ctx.replyWithInvoice({
      //   title: "اشتراک ماهانه",
      //   description:
      //     "با خرید اشتراک به امکانات ویژه دسترسی خواهید داشت.",
      //   payload: "premium_subscription_monthly",
      //   provider_token: "STARS",
      //   currency: "XTR",
      //   prices: [
      //     {
      //       label: "اشتراک 1 ماهه",
      //       amount: 1, // معادل 10 ستاره (1 ستاره = 10)
      //     },
      //   ],
      //   is_flexible: false,
      //   start_parameter: "subscribe-now",
      //   reply_markup: {
      //     inline_keyboard: [
      //       [
      //         {
      //           text: "پرداخت با ستاره‌ها",
      //           pay: true,
      //         },
      //       ],
      //     ],
      //   },
      // });

      try {
        ctx.reply("جنسیت خود را انتخاب کنید", {
          reply_markup: {
            keyboard: [
              [
                {
                  text: "خانم",
                },
                {
                  text: "آقا",
                },
              ],
              [
                {
                  text: "مرحله قبلی",
                },
              ],
            ],
            resize_keyboard: true,
            one_time_keyboard: false,
            is_persistent: true,
          },
        });
      } catch (error) {
        ctx.reply(
          "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
            "r9",
        );
      }
    }
  }
  if (step === "gender") {
    if (
      ctx?.message?.text === "خانم" ||
      ctx?.message?.text === "آقا"
    ) {
      savedUser.registerStep = "lookingFor";
      savedUser.gender =
        ctx?.message?.text === "خانم" ? "female" : "male";
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
        ctx.reply("دنبال چه کسی میگردید  ؟", {
          reply_markup: {
            keyboard: [
              [
                { text: "خانم" },
                { text: "آقا" },
                { text: "فرقی ندارد" },
              ],
              [{ text: "مرحله قبلی" }],
            ],
            resize_keyboard: true,
            one_time_keyboard: false,
            is_persistent: true,
          },
        });
      } catch (error) {
        ctx.reply(
          "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
            "r10",
        );
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
        ctx.reply("سن خود را انتخاب کنید", {
          reply_markup: {
            keyboard: [...chunkArray(ages, 4)],
            resize_keyboard: true,
            one_time_keyboard: false,
            is_persistent: true,
          },
        });
      } catch (error) {
        ctx.reply(
          "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
            "r11",
        );
      }
    } else {
      try {
        ctx.reply(
          "خطا در انتخاب جنسیت ، لطفا یکی از گزینه های زیر را انتخاب کنید",
          {
            reply_markup: {
              keyboard: [
                [
                  {
                    text: "خانم",
                  },
                  {
                    text: "آقا",
                  },
                ],
                [
                  {
                    text: "مرحله قبلی",
                  },
                ],
              ],
              resize_keyboard: true,
              one_time_keyboard: false,
              is_persistent: true,
            },
          },
        );
      } catch (error) {
        ctx.reply(
          "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
            "r12",
        );
      }
    }
  }
  if (step === "lookingFor") {
    if (
      ctx?.message?.text === "خانم" ||
      ctx?.message?.text === "آقا" ||
      ctx?.message?.text === "فرقی ندارد"
    ) {
      savedUser.registerStep = "state";
      savedUser.lookingFor =
        ctx?.message?.text === "خانم"
          ? "female"
          : ctx?.message?.text === "آقا"
            ? "male"
            : "noMatter";
      // await savedUser.save();

      await User.findOneAndUpdate(
        { telegramId },
        { registerStep: "state", lookingFor: savedUser.lookingFor },
      );

      usersMap.set(telegramId, {
        time: Date.now(),
        user: savedUser,
      });

      try {
        const showStates = states.map((item) => item.local);
        ctx.reply("استان خود را انتخاب کنید", {
          reply_markup: {
            keyboard: [
              [{ text: "مرحله قبلی" }],
              ...chunkArray(showStates, 3),
            ],
            resize_keyboard: true,
            one_time_keyboard: false,
            is_persistent: true,
          },
        });
      } catch (error) {
        ctx.reply(
          "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
            "r13",
        );
      }
    } else if (ctx?.message?.text === "مرحله قبلی") {
      savedUser.registerStep = "gender";
      // await savedUser.save();
      await User.findOneAndUpdate(
        { telegramId },
        { registerStep: "gender" },
      );

      usersMap.set(telegramId, {
        time: Date.now(),
        user: savedUser,
      });

      try {
        ctx.reply("جنسیت خود را انتخاب کنید", {
          reply_markup: {
            keyboard: [
              [
                {
                  text: "خانم",
                },
                {
                  text: "آقا",
                },
              ],
              [
                {
                  text: "مرحله قبلی",
                },
              ],
            ],
            resize_keyboard: true,
            one_time_keyboard: false,
            is_persistent: true,
          },
        });
      } catch (error) {
        ctx.reply(
          "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
            "r14",
        );
      }
    } else {
      try {
        ctx.reply("دنبال چه کسی میگردید ؟", {
          reply_markup: {
            keyboard: [
              [
                { text: "خانم" },
                { text: "آقا " },
                { text: "فرقی ندارد" },
              ],
              [{ text: "مرحله قبلی" }],
            ],
            resize_keyboard: true,
            one_time_keyboard: false,
            is_persistent: true,
          },
        });
      } catch (error) {
        ctx.reply(
          "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
            "r15",
        );
      }
    }
  }
  if (step === "state") {
    const findState = states.find(
      (s) => s.local === ctx?.message?.text,
    );

    if (ctx?.message?.text === "مرحله قبلی") {
      savedUser.registerStep = "lookingFor";
      // await savedUser.save();
      await User.findOneAndUpdate(
        { telegramId },
        { registerStep: "lookingFor" },
      );

      usersMap.set(telegramId, {
        time: Date.now(),
        user: savedUser,
      });

      try {
        ctx.reply("دنبال چه کسی میگردید ؟", {
          reply_markup: {
            keyboard: [
              [
                { text: "خانم" },
                { text: "آقا " },
                { text: "فرقی ندارد" },
              ],
              [{ text: "مرحله قبلی" }],
            ],
            resize_keyboard: true,
            one_time_keyboard: false,
            is_persistent: true,
          },
        });
      } catch (error) {
        ctx.reply(
          "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
            "r15",
        );
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
        ctx.reply("نام خود را وارد کنید", {
          reply_markup: {
            keyboard: [
              [{ text: telegramName }],
              [{ text: "مرحله قبلی" }],
            ],
            resize_keyboard: true,
            one_time_keyboard: false,
            is_persistent: true,
          },
        });
      } catch (error) {
        ctx.reply(
          "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
            "r20",
        );
      }
    } else {
      try {
        const showStates = states.map((item) => item.local);
        ctx.reply("شهر خود را انتخاب کنید", {
          reply_markup: {
            keyboard: [
              [{ text: "مرحله قبلی" }],
              ...chunkArray(showStates, 3),
            ],
            resize_keyboard: true,
            one_time_keyboard: false,
            is_persistent: true,
          },
        });
      } catch (error) {
        ctx.reply(
          "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
            "r21",
        );
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
        ctx.reply("شهر خود را انتخاب کنید", {
          reply_markup: {
            keyboard: [
              [{ text: "مرحله قبلی" }],
              ...chunkArray(showStates, 3),
            ],
            resize_keyboard: true,
            one_time_keyboard: false,
            is_persistent: true,
          },
        });
      } catch (error) {
        ctx.reply(
          "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
            "r22",
        );
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
        ctx.reply("نام خود را وارد کنید", {
          reply_markup: {
            keyboard: [
              [{ text: telegramName }],
              [{ text: "مرحله قبلی" }],
            ],
            resize_keyboard: true,
            one_time_keyboard: false,
            is_persistent: true,
          },
        });
      } catch (error) {
        ctx.reply(
          "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
            "r23",
        );
      }
    } else {
      const isBadWord = badWords.some((word) =>
        ctx?.message?.text
          ?.toLowerCase()
          .includes(word.toLowerCase()),
      );
      if (isBadWord) {
        ctx.reply("حاوی کلمات نامناسب");
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
        ctx.reply(
          "درباره خودت بیشتر بگو. دنبال چه کسی می‌گردی؟ می‌خوای چیکار کنی؟ من بهترین مچ‌ها رو پیدا می‌کنم برات",
          {
            reply_markup: {
              keyboard: [
                [
                  {
                    text: "رد شدن",
                  },
                ],
                [{ text: "مرحله قبلی" }],
              ],
              resize_keyboard: true,
              one_time_keyboard: false,
              is_persistent: true,
            },
          },
        );
      } catch (error) {
        ctx.reply(
          "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
            "r24",
        );
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
        ctx.reply("نام خود را وارد کنید", {
          reply_markup: {
            keyboard: [
              [{ text: telegramName }],
              [{ text: "مرحله قبلی" }],
            ],
            resize_keyboard: true,
            one_time_keyboard: false,
            is_persistent: true,
          },
        });
      } catch (error) {
        ctx.reply(
          "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
            "r25",
        );
        console.log({ error });
      }
    } else if (!ctx?.message?.text || ctx?.message?.text.length < 5) {
      try {
        ctx.reply(
          "درباره خودت بیشتر بگو. دنبال چه کسی می‌گردی؟ می‌خوای چیکار کنی؟ من بهترین مچ‌ها رو پیدا می‌کنم برات",
          {
            reply_markup: {
              keyboard: [[{ text: "مرحله قبلی" }]],
              resize_keyboard: true,
              one_time_keyboard: false,
              is_persistent: true,
            },
          },
        );
      } catch (error) {
        ctx.reply(
          "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
            "r26",
        );
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
        ctx.reply("شامل کلمات نامناسب");
        return;
      }
      // save bio

      savedUser.registerStep = "photo";
      savedUser.moreInformation.bio =
        ctx?.message?.text !== "رد شدن" ? ctx?.message?.text : "";
      // await savedUser.save();
      await User.findOneAndUpdate(
        { telegramId },
        {
          registerStep: "photo",
          moreInformation: {
            ...savedUser.moreInformation,
            bio: savedUser.moreInformation.bio,
          },
        },
      );

      usersMap.set(telegramId, {
        time: Date.now(),
        user: savedUser,
      });

      try {
        ctx.reply("عکس خود را ارسال کنید 🖼️", {
          reply_markup: {
            keyboard: [
              [
                {
                  text: "مرحله قبلی",
                },
              ],
            ],
            resize_keyboard: true,
            one_time_keyboard: false,
            is_persistent: true,
          },
        });
      } catch (error) {
        ctx.reply(
          "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
            "r27",
        );
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
        ctx.reply(
          "درباره خودت بیشتر بگو. دنبال چه کسی می‌گردی؟ می‌خوای چیکار کنی؟ من بهترین مچ‌ها رو پیدا می‌کنم برات",
          {
            reply_markup: {
              keyboard: [
                [
                  {
                    text: "رد شدن",
                  },
                ],
                [{ text: "مرحله قبلی" }],
              ],
              resize_keyboard: true,
              one_time_keyboard: false,
              is_persistent: true,
            },
          },
        );
      } catch (error) {
        ctx.reply(
          "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
            "r28",
        );
      }
    } else if (ctx.message.photo) {
      console.log("photooo");
      try {
        const photos = savedUser.profileImages || [];
        if (photos.length === 3) return;
        ctx.reply("⌛️");

        const fileId = ctx.message.photo.at(-1).file_id;
        const fileLink = await ctx.telegram.getFileLink(fileId);

        console.log("1111");
        const imageUrl = await uploadImageFromUrl(fileLink);
        console.log("2222");
        if (photos.length === 3) return;
        photos.push(imageUrl);
        await Pictures.create({
          telegramId: +telegramId || savedUser.telegramId || 0,
          url: imageUrl,
        });

        savedUser.profileImages = photos;
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

        setTimeout(async () => {
          const photos = savedUser.profileImages;
          const fullName = savedUser.fullName;
          const age = savedUser.age;
          const state = savedUser.state;
          const bio = savedUser.moreInformation.bio;

          console.log({ photos });

          await ctx.replyWithPhoto(
            {
              source: fs.createReadStream(photos[0]),
            },
            {
              caption: `${fullName}, ${age}, ${state} ${
                bio ? "\n" + bio : ""
              } `,
              reply_markup: {
                keyboard: [[{ text: "❤️" }, { text: "👉🏻" }]],
                resize_keyboard: true,
                one_time_keyboard: false,
                is_persistent: true,
              },
            },
          );

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
          ctx.reply("درسته ؟", {
            reply_markup: {
              keyboard: [
                [{ text: "بله" }, { text: "ویرایش پروفایلم" }],
              ],
              resize_keyboard: true,
              one_time_keyboard: false,
              is_persistent: true,
            },
          });
        }, 1000);

        return;
        // }

        return;
        // }
      } catch (error) {
        ctx.reply(
          "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
            "r30",
        );
        console.log({ error });
      }
    } else if (ctx?.message?.text === "تمام ، ذخیره تصاویر ✅") {
      ctx.reply("⌛️");

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

      try {
        const photos = savedUser.profileImages;
        const fullName = savedUser.fullName;
        const age = savedUser.age;
        const state = savedUser.state;
        const bio = savedUser.moreInformation.bio;

        await ctx.replyWithPhoto(
          {
            source: fs.createReadStream(photos[0]),
          },
          {
            caption: `${fullName}, ${age}, ${state} ${
              bio ? "\n" + bio : ""
            } `,
            reply_markup: {
              keyboard: [[{ text: "❤️" }, { text: "👉🏻" }]],
              resize_keyboard: true,
              one_time_keyboard: false,
              is_persistent: true,
            },
          },
        );

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

        ctx.reply("درسته ؟", {
          reply_markup: {
            keyboard: [
              [{ text: "بله" }, { text: "ویرایش پروفایلم" }],
            ],
            resize_keyboard: true,
            one_time_keyboard: false,
            is_persistent: true,
          },
        });
      } catch (error) {
        ctx.reply(
          "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
            "r31",
        );
      }
      return;
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
        ctx.reply("عکس خود را ارسال کنید 🖼️", {
          reply_markup: {
            keyboard: [[{ text: "مرحله قبلی" }]],
            resize_keyboard: true,
            one_time_keyboard: false,
            is_persistent: true,
          },
        });
      } catch (error) {
        ctx.reply(
          "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
            "r32",
        );
      }
    }
  }
  if (step === "isCorrectProfile") {
    if (ctx?.message?.text === "بله") {
      const language = savedUser.language;
      const age = savedUser.age;
      const gender = savedUser.gender;
      const lookingFor = savedUser.lookingFor;
      const country = savedUser.country;
      const state = savedUser.state;
      const name = savedUser.fullName;
      const bio = savedUser.moreInformation.bio;
      const profileImages = savedUser.profileImages;

      foryouQueue.add({ telegramId });

      // ست کردن کاربران اولیه در forYou
      const getData = await redisClient.getBuffer(
        `city:${lookingFor.toLowerCase()}:${state.toLowerCase()}`,
      );

      if (Buffer.isBuffer(getData)) {
        const userRoot = await protobuf.load(
          "./protoBuf_files/foryou.proto",
        );

        let ForyouProto = userRoot.lookupType("Users");
        const decodedMessage = ForyouProto.decode(getData);
        let usersArrayFromRedis = decodedMessage.users || [];
        if (usersArrayFromRedis.length < 100) {
          const getDataGlobal = await redisClient.getBuffer(
            `globalUsers:${lookingFor.toLowerCase()}`,
          );
          if (Buffer.isBuffer(getDataGlobal)) {
            const decodedMessage2 = ForyouProto.decode(getData);
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

      if (
        language &&
        age &&
        gender &&
        lookingFor &&
        state &&
        country &&
        name
      ) {
        try {
          // save in redis
          await redisClient.hmset(`user:${savedUser.telegramId}`, {
            lastUpdate: Date.now(),
            lastSeen: Date.now(),
            createAt: Date.now(),
            language,
            age: age.toString(),
            gender,
            lookingFor,
            country,
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
                bio,
                profileImages,
              } = forYouList.get(telegramId)[0];

              const photos = profileImages;

              await ctx.replyWithPhoto(
                {
                  source: fs.createReadStream(photos[0]),
                },
                {
                  caption: `${fullName}, ${age}, ${state} ${
                    bio ? "\n" + bio : ""
                  } `,
                  reply_markup: {
                    keyboard: [[{ text: "❤️" }, { text: "👉🏻" }]],
                    resize_keyboard: true,
                    one_time_keyboard: false,
                    is_persistent: true,
                  },
                },
              );

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
              // add to search queue

              // suggestQueue.add({
              //   telegramId,
              //   user: savedUser,
              // });

              const userSavedd = await User.findOne({ telegramId });
              console.log({ userSavedd });
              suggestQueue.add({
                telegramId,
                user: userSavedd,
              });

              setTimeout(async () => {
                try {
                  const {
                    fullName,
                    age,
                    state,
                    bio,
                    profileImages,
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
                      one_time_keyboard: false,
                      is_persistent: true,
                    },
                  });
                  const photos = profileImages;

                  await ctx.replyWithPhoto(
                    {
                      source: fs.createReadStream(photos[0]),
                    },
                    {
                      caption: `${fullName}, ${age}, ${state} ${
                        bio ? "\n" + bio : ""
                      } `,
                      reply_markup: {
                        keyboard: [[{ text: "❤️" }, { text: "👉🏻" }]],
                        resize_keyboard: true,
                        one_time_keyboard: false,
                        is_persistent: true,
                      },
                    },
                  );

                  // const photos = existingUser.profileImages || [];
                  // await ctx.replyWithMediaGroup(
                  //   photos.map((photo, index) => ({
                  //     type: "photo",
                  //     media: photo,
                  //     caption:
                  //       index === 0
                  //         ? `${fullName}, ${age}, ${
                  //             state
                  //           } ${bio ? "\n" + bio : ""} `
                  //         : undefined,
                  //   })),
                  // );
                } catch (error) {
                  console.log({ error });
                }
              }, 3000);
            }
          } catch (error) {
            console.log({ error });
          }
        } catch (error) {
          ctx.reply(
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
              "r34",
          );
        }
      } else {
        ctx.reply(
          "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)",
        );
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

      ctx.reply(
        `1. ${"مشاهده پروفایل ها"} \n2. ${"ویرایش پروفایلم"} \n3. ${"تغییر عکس من"}`,
        {
          reply_markup: {
            keyboard: [
              [{ text: "1🚀" }, { text: "2" }, { text: "3" }],
            ],
            resize_keyboard: true,
            one_time_keyboard: false,
            is_persistent: true,
          },
        },
      );
    } else {
      const photos = savedUser.profileImages || [];
      const fullName = savedUser.fullName;
      const age = savedUser.age;
      const state = savedUser.state;
      const bio = savedUser.moreInformation.bio;

      try {
        await ctx.replyWithPhoto(
          {
            source: fs.createReadStream(photos[0]),
          },
          {
            caption: `${fullName}, ${age}, ${state} ${
              bio ? "\n" + bio : ""
            } `,
            reply_markup: {
              keyboard: [[{ text: "❤️" }, { text: "👉🏻" }]],
              resize_keyboard: true,
              one_time_keyboard: false,
              is_persistent: true,
            },
          },
        );

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
        ctx.reply("درسته ؟", {
          reply_markup: {
            keyboard: [
              [{ text: "بله" }, { text: "ویرایش پروفایلم" }],
            ],
            resize_keyboard: true,
            one_time_keyboard: false,
            is_persistent: true,
          },
        });
      } catch (error) {
        ctx.reply(
          "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
            "r35",
        );
        console.log({ error });
      }

      return;
    }
  }
};

module.exports = {
  registerInBot,
};
