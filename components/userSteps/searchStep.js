const {
  generateInviteCode,
} = require("../../utils/generateInviteCode.js");

const searchStep = async (
  ctx,
  next,
  redisClient,
  telegramId,
  existingUser,
  usersMap,
  forYouList,
  forYouTime,
  suggestQueue,
) => {
  // Handle like actions (❤️, 💌)
  if (
    ctx?.message?.text === "❤️" ||
    ctx?.message?.text === "❌" ||
    ctx?.message?.text === "💌"
  ) {
    if (
      existingUser.firstLikeTime + 86400000 > Date.now() &&
      existingUser.likeCount > 50
    ) {
      if (existingUser.giftLikeCount > 0) {
        existingUser.giftLikeCount -= 1;
        usersMap.set(telegramId, {
          time: Date.now(),
          user: existingUser,
        });
      } else {
        try {
          // await ctx.reply(
          //   "⚠️  شما فقط تعداد محدودی لایک در روز می‌توانید داشته باشید. برای لایک بیشتر دوستان خود را دعوت کنید و 100 لایک هدیه بگیرید.",
          // );
          await reply(
            ctx,
            next,
            redisClient,
            "⚠️  شما فقط تعداد محدودی لایک در روز می‌توانید داشته باشید. برای لایک بیشتر دوستان خود را دعوت کنید و 100 لایک هدیه بگیرید.",
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
    } else if (existingUser.firstLikeTime + 86400000 < Date.now()) {
      existingUser.firstLikeTime = Date.now();
      existingUser.likeCount = 1;
      usersMap.set(telegramId, {
        time: Date.now(),
        user: existingUser,
      });
    } else {
      existingUser.firstLikeTime = Date.now();
      existingUser.likeCount = (existingUser.likeCount || 0) + 1;
      usersMap.set(telegramId, {
        time: Date.now(),
        user: existingUser,
      });
    }
  }

  // Handle forYouList queue management
  if (
    forYouList.get(telegramId) &&
    Array.isArray(forYouList.get(telegramId)) &&
    forYouList.get(telegramId).length > 10 &&
    forYouTime.get(telegramId) &&
    forYouTime.get(telegramId) + 600000 > Date.now()
  ) {
    // List is still valid, no need to add to queue
  } else {
    forYouTime.set(telegramId, Date.now());
    // add to search queue
    suggestQueue.add({
      telegramId,
      user: existingUser,
    });
  }
};

module.exports = searchStep;
