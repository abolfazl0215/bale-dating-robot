const User = require("../models/User");
const protobuf = require("protobufjs");

const removeFromExplore = async (telegramId, redisClient,ActiveUsersProto) => {
  try {
    // const userRoot = await protobuf.load(
    //   "./protoBuf_files/foryou.proto",
    // );
    // let ActiveUsersProto = userRoot.lookupType("Users");

    const findUser = await User.findOne({ telegramId });

    if (!findUser) {
      console.error("User not found");
      return;
    }

    const removeFromRedis = async (keyType) => {
      try {
        // تعیین کلید redis بر اساس نوع درخواست
        let redisKey;
        if (keyType === "city") {
          redisKey = `city:${findUser.gender.toLowerCase()}:${findUser?.state.toLowerCase()}`;
        } else if (keyType === "global") {
          redisKey = `globalUsers:${findUser.gender.toLowerCase()}`;
        } else {
          console.error("Invalid key type. Use 'city' or 'global'.");
          return;
        }

        // بررسی وجود داده در ردیس
        const getData = await redisClient.getBuffer(redisKey);

        if (!Buffer.isBuffer(getData)) {
          console.log(`No data found in Redis for key: ${redisKey}`);
          return;
        }

        try {
          const decodeBuffer = ActiveUsersProto.decode(getData);

          // فیلتر کردن کاربر از لیست
          const filteredUsers = decodeBuffer.users.filter(
            (f) => +f.telegramId !== +telegramId,
          );

          // اگر هیچ تغییری نکرده، نیازی به ذخیره نیست
          if (filteredUsers.length === decodeBuffer.users.length) {
            console.log(`User ${telegramId} not found in ${keyType}`);
            return;
          }

          // اعتبارسنجی داده‌ها
          const errMsg = ActiveUsersProto.verify({ users: filteredUsers });
          if (errMsg) {
            console.error("Protobuf validation error:", errMsg);
            return;
          }

          // تبدیل به protobuf و ذخیره در ردیس
          const message_ = ActiveUsersProto.create({
            users: filteredUsers,
          });
          const buffer = ActiveUsersProto.encode(message_).finish();
          await redisClient.set(redisKey, buffer);

          console.log(`User ${telegramId} removed from ${keyType}`);
        } catch (decodeError) {
          console.error(
            "Error decoding buffer from Redis:",
            decodeError,
          );
        }
      } catch (error) {
        console.error(
          `Error in removeFromRedis (${keyType}):`,
          error,
        );
      }
    };

    // استفاده از تابع
    await removeFromRedis("city");
    await removeFromRedis("global");
  } catch (error) {
    console.error("Error in removeFromExplore:", error);
  }
};

module.exports = removeFromExplore;
