const fs = require("fs");
const User = require("../../models/User");

const menuStep = async (
  ctx,
  existingUser,
  usersMap,
  forYouList,
  forYouTime,
  telegramId,
  generateInviteLink,
  suggestQueue,
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
          inviteCode: inviteCode_from_forYouList,
        } = forYouList.get(telegramId)[0];

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
          console.log({ photos2: photos });

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

      console.log({ photos3: photos });

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
  } else if (ctx?.message?.text === "4") {
    existingUser.userStep = "invite";
    usersMap.set(telegramId, {
      time: Date.now(),
      user: existingUser,
    });
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

    return;
  } else {
    try {
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
  }
};

module.exports = menuStep;
