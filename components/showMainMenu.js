const User = require("../models/User");

const showMainMenu = async (
  ctx,
  telegramId,
  existingUser,
  usersMap,
) => {
  try {
    existingUser.userStep = "menu";

    // Update user in database
    await User.findOneAndUpdate({ telegramId }, { userStep: "menu" });

    // Update user in map
    usersMap.set(telegramId, {
      time: Date.now(),
      user: existingUser,
    });

    if (ctx?.message?.text === "☰") {
      try {
        await ctx.reply(
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
        console.log(error);
      }
      // Show main menu
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
        try {
          await ctx.reply(
            "❤️ : لایک\n❌ : (رد کردن)نوپ\n💌 : پیام\n☰ : منو\n\nوقتی کاربری را لایک میکنید ، لایک شما برای او ارسال میشود و اگر اوهم شما را لایک کند ، متصل میشوید .",
          );
        } catch (error) {
          console.log(error);
        }

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
        list.shift(); // Remove the first item
        forYouList.set(telegramId, list);
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
        await ctx.replyWithMediaGroup(
          photos.map((photo, index) => ({
            type: "photo",
            media: photo,
            caption:
              index === 0
                ? `${fullName}, ${age}, ${flag + " " + state} ${
                    bio ? "\n" + bio : ""
                  }\n/user_${inviteCode_from_forYouList || "not_found"}`
                : undefined,
          })),
        );
      } catch (error) {
        console.log(error);
      }

      existingUser.lastViewed =
        +forYouList.get(telegramId)[0].telegramId;
      usersMap.set(telegramId, {
        time: Date.now(),
        user: existingUser,
      });
    } else if (ctx?.message?.text === "❌") {
      const targetId = forYouList.get(telegramId)?.[0]?.telegramId;

      if (!existingUser.firstNope) {
        try {
          await ctx.reply(
            "❤️ : لایک\n❌ : (رد کردن)نوپ\n💌 : پیام\n☰ : منو\n\nوقتی کاربری را لایک میکنید ، لایک شما برای او ارسال میشود و اگر اوهم شما را لایک کند ، متصل میشوید .",
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
          targetId,
        },
      });

      const list = forYouList.get(telegramId);
      if (Array.isArray(list)) {
        list.shift();
        forYouList.set(telegramId, list);
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
        await ctx.replyWithMediaGroup(
          photos.map((photo, index) => ({
            type: "photo",
            media: photo,
            caption:
              index === 0
                ? `${fullName}, ${age}, ${flag + " " + state} ${
                    bio ? "\n" + bio : ""
                  }\n/user_${inviteCode_from_forYouList || "not_found"}`
                : undefined,
          })),
        );
      } catch (error) {
        console.log(error);
      }

      existingUser.lastViewed =
        +forYouList.get(telegramId)[0].telegramId;
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
      try {
        await ctx.reply("پیام خود را ارسال کنید 🧐👇🏽");
      } catch (error) {
        console.log(error);
      }
    } else {
      try {
        await ctx.reply("🧐👇🏽", {
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
            is_persistent: true,
          },
        });
      } catch (error) {
        console.log(error);
      }
    }
  } catch (error) {
    console.error("Error in showMainMenu:", error);
    try {
      await ctx.reply(
        "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
          "r3",
      );
    } catch (e) {}
  }
};

module.exports = showMainMenu;
