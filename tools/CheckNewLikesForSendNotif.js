const { redisClient } = require("../config/redis.js");
const bot = require("../utils/bot.js");
const usersMap = require("../utils/usersMap.js");
const User = require("../models/User.js");

const protobuf = require("protobufjs");
const { texts } = require("../data/languages.js");


const checkNewLikesForSendNotif = async () => {
  try {
    const getData = await redisClient.getBuffer(`newLikes`);

    if (Buffer.isBuffer(getData)) {
      const userRoot = await protobuf.load(
        "./protoBuf_files/newLike.proto",
      );
      let NewLikeProto = userRoot.lookupType("Users");
      const decodedMessage = NewLikeProto.decode(getData);
      let newLikes = decodedMessage.users || [];

      if (newLikes.length === 0) return;

      // لیست کاربرانی که باید حذف شوند
      const usersToRemove = [];

      await Promise.all(
        newLikes.map(async (user) => {
          try {
            const telegramId__ = +user.telegramId;

            const numberOfMen = user.likers.filter(
              (liker) => liker.gender === "male",
            ).length;

            const numberOfWomen = user.likers.filter(
              (liker) => liker.gender === "female",
            ).length;

            let findUser;

            if (usersMap.get(telegramId__)) {
              findUser = usersMap.get(telegramId__).user;
              usersMap.get(telegramId__).time = Date.now();
            } else {
              findUser = await User.findOne({
                telegramId: telegramId__,
              });
              if (findUser) {
                usersMap.set(telegramId__, {
                  user: findUser,
                  time: Date.now(),
                });
              }
            }

            if (
              findUser?.userStep !== "notificationMenu" &&
              findUser?.userStep !== "notifications" &&
              findUser?.userStep !== "register" &&
              findUser?.userStep !== "editProfile" &&
              findUser?.userStep !== "editProfileMenu" &&
              findUser?.userStep !== "notificationSleepMode" &&
              !findUser?.sleep &&
              (numberOfWomen !== 0 || numberOfMen !== 0)
            ) {
              try {
                await bot.telegram.getChat(+telegramId__);

                await bot.telegram.sendMessage(
                  +telegramId__,
                  `${
                    numberOfMen !== 0 ? `${numberOfMen} ${"آقا"}` : ""
                  } ${
                    numberOfMen !== 0 && numberOfWomen !== 0
                      ? "و"
                      : ""
                  } ${
                    numberOfWomen !== 0
                      ? `${numberOfWomen} ${"خانم"}`
                      : ""
                  } ${"شما را لایک کردند . یه نگاهی بنداز "}.\n\n1. ${"نمایش"}\n2. ${"حالت خواب"}`,
                  {
                    reply_markup: {
                      keyboard: [[{ text: "1 🚀" }, { text: "2" }]],
                      resize_keyboard: true,
                      one_time_keyboard: false,
                      is_persistent: true,
                    },
                  },
                );

                if (findUser) {
                  findUser.userStep = "notificationMenu";
                  usersMap.set(telegramId__, {
                    user: findUser,
                    time: Date.now(),
                  });
                }
              } catch (chatError) {
                // اگر chat پیدا نشد یا کاربر ربات را بلاک کرده
                if (
                  chatError.response?.error_code === 400 ||
                  chatError.response?.error_code === 403
                ) {
                  console.log(
                    `Cannot send message to user ${telegramId__}: ${chatError.response?.description}`,
                  );

                  // اضافه کردن کاربر به لیست حذف
                  usersToRemove.push(telegramId__);
                } else {
                  throw chatError;
                }
              }
            }
          } catch (userError) {
            console.error(
              `Error processing user: ${userError.message}`,
            );
          }
        }),
      );

      // حذف کاربران غیرفعال از لیست
      if (usersToRemove.length > 0) {
        const updatedNewLikes = newLikes.filter(
          (user) => !usersToRemove.includes(+user.telegramId),
        );

        // ذخیره لیست به‌روز شده در Redis
        const updatedMessage = NewLikeProto.create({
          users: updatedNewLikes,
        });
        const buffer = NewLikeProto.encode(updatedMessage).finish();
        await redisClient.set(`newLikes`, buffer);

        console.log(
          `Removed ${usersToRemove.length} inactive users from newLikes list:`,
          usersToRemove,
        );
      }
    }
  } catch (error) {
    console.log("Main interval error:", error);
  }
};

module.exports = checkNewLikesForSendNotif;
