const fs = require("fs");
const User = require("../../models/User");
const { getPic } = require("../../utils/getPic");
const { reply } = require("../../telegram_methods/reply");
const { requestToFillSuggestQueue } = require("../../config/redis");
const { checkUrl } = require("../../utils/checkUrl");

const menuStep = async (
  ctx,
  next,
  existingUser,
  usersMap,
  forYouList,
  forYouTime,
  telegramId,
  generateInviteLink,
  redisClient,
) => {
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

        const {
          fullName,
          age,
          state,
          bio,
          profileImages,
          inviteCode: inviteCode_from_forYouList,
        } = forYouList.get(telegramId)[0];

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
        forYouTime.set(telegramId, Date.now());
        // add to search queue
        requestToFillSuggestQueue.add({
          telegramId,
          user: existingUser,
        });

        // setTimeout(async () => {
        try {
          const {
            fullName,
            age,
            state,
            bio,
            profileImages,
            inviteCode: inviteCode_from_forYouList,
          } = forYouList.get(telegramId)[0];

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

          const photos = profileImages;
          // console.log({ photos2: photos });

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
      const bio = existingUser?.bio ?? "";
      const inviteCode = existingUser.inviteCode;

      // console.log({ photos3: photos });

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
            } \n/user_${inviteCode || "not_found"}`,
          },
        );
      } catch (error) {
        try {
          // await ctx.reply(
          //   `${fullName}, ${age}, ${state} ${
          //     bio ? "\n" + bio : ""
          //   } \n/user_${inviteCode || "not_found"}`,
          // );
          await reply(
            ctx,
            next,
            redisClient,
            `${fullName}, ${age}, ${state} ${
              bio ? "\n" + bio : ""
            } \n/user_${inviteCode || "not_found"}`,
          );
        } catch (error) {
          console.log(error);
        }
      }

      await User.updateOne(
        { telegramId },
        { userStep: "editProfileMenu" },
      );

      existingUser.userStep = "editProfileMenu";

      usersMap.set(telegramId, {
        time: Date.now(),
        user: existingUser,
      });


      await reply(
        ctx,
        next,
        redisClient,
        `1. ${"مشاهده پروفایل ها"} \n2. ${"ویرایش پروفایلم"} \n3. ${"تغییر عکس من"}`,
        [[{ text: "1🚀" }, { text: "2" }, { text: "3" }]],
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
  } else if (ctx?.message?.text === "4") {
    try {
      existingUser.userStep = "invite";
      usersMap.set(telegramId, {
        time: Date.now(),
        user: existingUser,
      });
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

    return;
  } else {
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
      console.log({ error });
    }
  }
};

module.exports = menuStep;
