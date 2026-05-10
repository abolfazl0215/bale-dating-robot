const axios = require("axios");
const fs = require("fs");
const User = require("../models/User");
const countries = require("../data/countries.json");
const { uploadImageFromUrl } = require("./uploadImageFromUrl");
const badWords = require("../data/words");
const protobuf = require("protobufjs");
const usersMap = require("../utils/usersMap");
const { getPic } = require("../utils/getPic");

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
  chunkArray,
  ages,
  telegramId,
  savedUser,
  redisClient,
  forYouList,
  forYouTime,
  suggestQueue,
  foryouQueue,
  telegramName,
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
        await ctx.reply(
          "خطا ، لطفا یکی از اعداد زیر را انتخاب کنید",
          {
            reply_markup: {
              keyboard: [...chunkArray(ages, 4)],
              resize_keyboard: true,
              one_time_keyboard: false,
              is_persistent: true,
            },
          },
        );
      } catch (error) {
        try {
          await ctx.reply(
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
              "r8",
          );
          console.log(error);
        } catch (e) {}
      }
    } else {
      savedUser.editProfileStep = "gender";
      savedUser.age = Number(ctx?.message?.text) || 1;
      // await savedUser.save();

      await User.findOneAndUpdate(
        { telegramId },
        { editProfileStep: "gender", age: savedUser.age },
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
        await ctx.reply("جنسیت خود را انتخاب کنید", {
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
        try {
          await ctx.reply(
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
              "r9",
          );
        } catch (e) {}
      }
    }
  }
  if (step === "gender") {
    if (
      ctx?.message?.text === "خانم" ||
      ctx?.message?.text === "آقا"
    ) {
      savedUser.editProfileStep = "lookingFor";
      savedUser.gender =
        ctx?.message?.text === "خانم" ? "female" : "male";
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
        await ctx.reply("به دنبال چه کسی می گردید ؟", {
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
        try {
          await ctx.reply(
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
              "r10",
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
        await ctx.reply("سن خود را انتخاب کنید", {
          reply_markup: {
            keyboard: [...chunkArray(ages, 4)],
            resize_keyboard: true,
            one_time_keyboard: false,
            is_persistent: true,
          },
        });
      } catch (error) {
        try {
          await ctx.reply(
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
              "r11",
          );
        } catch (e) {}
      }
    } else {
      try {
        await ctx.reply(
          "خطا ، لطفا یکی از گزینه های زیر را انتخاب کنید",
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
        try {
          await ctx.reply(
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
              "r12",
          );
        } catch (e) {}
      }
    }
  }
  if (step === "lookingFor") {
    if (
      ctx?.message?.text === "خانم" ||
      ctx?.message?.text === "آقا" ||
      ctx?.message?.text === "فرقی ندارد"
    ) {
      savedUser.editProfileStep = "state";
      savedUser.lookingFor =
        ctx?.message?.text === "خانم"
          ? "female"
          : ctx?.message?.text === "آقا"
            ? "male"
            : "noMatter";
      // await savedUser.save();

      await User.findOneAndUpdate(
        { telegramId },
        {
          editProfileStep: "state",
          lookingFor: savedUser.lookingFor,
        },
      );

      usersMap.set(telegramId, {
        time: Date.now(),
        user: savedUser,
      });

      try {
        const showStates = states.map((item) => item.local);
        await ctx.reply("استان خود را انتخاب کنید", {
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
        try {
          await ctx.reply(
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
              "r13",
          );
        } catch (e) {}
      }
    } else if (ctx?.message?.text === "مرحله قبلی") {
      savedUser.editProfileStep = "gender";
      // await savedUser.save();

      await User.findOneAndUpdate(
        { telegramId },
        { editProfileStep: "gender" },
      );

      usersMap.set(telegramId, {
        time: Date.now(),
        user: savedUser,
      });

      try {
        await ctx.reply("جنسیت خود را انتخاب کنید", {
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
        try {
          await ctx.reply(
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
              "r14",
          );
        } catch (e) {}
      }
    } else {
      try {
        await ctx.reply("به دنبال چه کسی می گردید ؟", {
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
        try {
          await ctx.reply(
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
              "r15",
          );
        } catch (e) {}
      }
    }
  }
  if (step === "state") {
    const findState = states.find(
      (s) => s.local === ctx?.message?.text,
    );
    console.log({ findState, message: ctx?.message?.text });

    if (ctx?.message?.text === "مرحله قبلی") {
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
        await ctx.reply("دنبال چه کسی میگردید ؟", {
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
        try {
          await ctx.reply(
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
              "r15",
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
        await ctx.reply("نام خود را وارد کنید", {
          reply_markup: {
            keyboard: [
              [{ text: telegramName || "" }],
              [{ text: "مرحله قبلی" }],
            ],
            resize_keyboard: true,
            one_time_keyboard: false,
            is_persistent: true,
          },
        });
      } catch (error) {
        try {
          await ctx.reply(
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
              "r20",
          );
        } catch (e) {}
      }
    } else {
      try {
        const showStates = states.map((item) => item.local);
        await ctx.reply("شهر خود را انتخاب کنید", {
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
        try {
          await ctx.reply(
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
              "r21",
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
        await ctx.reply("یکی از استان های زیر را انتخاب کنید", {
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
        try {
          await ctx.reply(
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
              "r22",
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
        await ctx.reply("نام خود را وارد کنید", {
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
        try {
          await ctx.reply(
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
              "r23",
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
          ctx.reply("حاوی کلمات نامناسب");
        } catch (e) {}
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
        await ctx.reply(
          `درباره خودت بیشتر بگو. دنبال چه کسی می‌گردی؟ می‌خوای چیکار کنی؟ من بهترین مچ‌ها رو پیدا می‌کنم برات.`,
          {
            reply_markup: {
              keyboard: [
                [
                  {
                    text: savedUser?.moreInformation?.bio
                      ? savedUser?.moreInformation?.bio
                      : "رد شدن",
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
        try {
          await ctx.reply(
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
              "r24",
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
        await ctx.reply("نام خود را وارد کنید", {
          reply_markup: {
            keyboard: [
              [{ text: savedUser.fullName || "-" }],
              [{ text: "مرحله قبلی" }],
            ],
            resize_keyboard: true,
            one_time_keyboard: false,
            is_persistent: true,
          },
        });
      } catch (error) {
        try {
          await ctx.reply(
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
              "r25",
          );
        } catch (e) {}
      }
    } else if (!ctx?.message?.text || ctx?.message?.text.length < 5) {
      try {
        await ctx.reply(
          `درباره خودت بیشتر بگو. دنبال چه کسی می‌گردی؟ می‌خوای چیکار کنی؟ من بهترین مچ‌ها رو پیدا می‌کنم برات.`,
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
        try {
          await ctx.reply(
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
              "r26",
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
          await ctx.reply("حاوی کلمات نامناسب");
        } catch (e) {}
        return;
      }
      // save bio

      try {
        await ctx.reply("⌛️");
      } catch (e) {}

      savedUser.moreInformation.bio =
        ctx?.message?.text !== "رد شدن" ? ctx?.message?.text : "";
      savedUser.editProfileStep = "isCorrectProfile";
      // await savedUser.save();

      await User.findOneAndUpdate(
        { telegramId },
        {
          editProfileStep: "isCorrectProfile",
          "moreInformation.bio": savedUser.moreInformation.bio,
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
        const bio = savedUser.moreInformation.bio;

        try {
          // const buffer = await getPic(photos[0]);
          await ctx.replyWithPhoto(
            {
              source:
                fs.existsSync(photos[0]) &&
                fs.createReadStream(photos[0]),
            },
            {
              caption: `${fullName}, ${age}, ${state} ${
                bio ? "\n" + bio : ""
              } `,
            },
          );
        } catch (error) {
          try {
            await ctx.reply(
              `${fullName}, ${age}, ${state} ${
                bio ? "\n" + bio : ""
              } `,
            );
          } catch (error) {
            console.log(error);
          }
        }

        // await ctx.replyWithMediaGroup(
        //   photos.map((photo, index) => ({
        //     type: "photo",
        //     media: photo,
        //     caption:
        //       index === 0
        //         ? `${fullName}, ${age}, ${flag + " " + state} ${
        //             bio ? "\n" + bio : ""
        //           } `
        //         : undefined,
        //   })),
        // );

        await ctx.reply("درسته ؟", {
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
        try {
          await ctx.reply(
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
              "r31",
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
      const bio = savedUser.moreInformation.bio;
      const profileImages = savedUser.profileImages;
      const flag = savedUser.flag;

      foryouQueue.add({ telegramId });

      if (
        !Array.isArray(forYouList.get(telegramId)) ||
        forYouList.get(telegramId).length < 10
      ) {
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
          console.log({ usersArrayFromRedis });
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
            flag,
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
              await ctx.reply("🔎", {
                reply_markup: {
                  keyboard: [
                    [
                      { text: "☰" },
                      { text: "❤️" },
                      { text: "❌" },
                      { text: "💌" },
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
              } = forYouList.get(telegramId)[0];

              const photos = profileImages;

              try {
                // const buffer = await getPic(photos[0]);
                await ctx.replyWithPhoto(
                  {
                    source:
                      fs.existsSync(photos[0]) &&
                      fs.createReadStream(photos[0]),
                  },
                  {
                    caption: `${fullName}, ${age}, ${state} ${
                      bio ? "\n" + bio : ""
                    } `,
                  },
                );
              } catch (error) {
                try {
                  await ctx.reply(
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
              //         ? `${fullName}, ${age}, ${flag + " " + state} ${
              //             bio ? "\n" + bio : ""
              //           } `
              //         : undefined,
              //   })),
              // );
            } else {
              forYouTime.set(telegramId, Date.now());
              // add to search queue
              suggestQueue.add({
                telegramId,
                user: savedUser,
              });

              try {
                await ctx.reply("🔎", {
                  reply_markup: {
                    keyboard: [
                      [
                        { text: "☰" },
                        { text: "❤️" },
                        { text: "❌" },
                        { text: "💌" },
                      ],
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: false,
                    is_persistent: true,
                  },
                });
              } catch (e) {}

              setTimeout(async () => {
                try {
                  const { fullName, age, state, bio, profileImages } =
                    forYouList.get(telegramId)[0];

                  const photos = profileImages;

                  try {
                    // const buffer = await getPic(photos[0]);
                    await ctx.replyWithPhoto(
                      {
                        source:
                          fs.existsSync(photos[0]) &&
                          fs.createReadStream(photos[0]),
                      },
                      {
                        caption: `${fullName}, ${age}, ${state} ${
                          bio ? "\n" + bio : ""
                        } `,
                      },
                    );
                  } catch (error) {
                    try {
                      await ctx.reply(
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
                  //         ? `${fullName}, ${age}, ${
                  //             flag + " " + state
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
            await ctx.reply(
              "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
                "r34",
            );
          } catch (e) {}
        }
      } else {
        try {
          await ctx.reply(
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)",
          );
        } catch (e) {}
      }
    } else if (ctx?.message?.text === "ویرایش پروفایلم") {
      await User.updateOne(
        { telegramId },
        { userStep: "editProfileMenu" },
      );

      savedUser.userStep = "editProfileMenu";
      // await savedUser.save();

      await User.findOneAndUpdate(
        { telegramId },
        { userStep: "editProfileMenu" },
      );

      usersMap.set(telegramId, {
        time: Date.now(),
        user: savedUser,
      });

      try {
        await ctx.reply(
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
      } catch (error) {
        console.log(error);
      }
    } else {
      const photos = savedUser.profileImages || [];
      const fullName = savedUser.fullName;
      const age = savedUser.age;
      const state = savedUser.state;
      const flag = savedUser.flag;
      const bio = savedUser.moreInformation.bio;

      try {
        try {
          // const buffer = await getPic(photos[0]);
          await ctx.replyWithPhoto(
            {
              source:
                fs.existsSync(photos[0]) &&
                fs.createReadStream(photos[0]),
            },
            {
              caption: `${fullName}, ${age}, ${state} ${
                bio ? "\n" + bio : ""
              } `,
            },
          );
        } catch (error) {
          try {
            await ctx.reply(
              `${fullName}, ${age}, ${state} ${
                bio ? "\n" + bio : ""
              } `,
            );
          } catch (error) {
            console.log(error);
          }
        }

        // await ctx.replyWithMediaGroup(
        //   photos.map((photo, index) => ({
        //     type: "photo",
        //     media: photo,
        //     caption:
        //       index === 0
        //         ? `${fullName}, ${age}, ${flag + " " + state} ${
        //             bio ? "\n" + bio : ""
        //           } `
        //         : undefined,
        //   })),
        // );
        await ctx.reply("درسته ؟", {
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
        try {
          await ctx.reply(
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
              "r35",
          );
        } catch (e) {}
        console.log({ error });
      }

      return;
    }
  }
};

module.exports = editProfileInBot;
