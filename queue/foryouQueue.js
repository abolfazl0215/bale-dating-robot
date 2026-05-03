const { redisClient } = require("../config/redis");
const User = require("../models/User");
const protobuf = require("protobufjs");

const foryouQueueController = async ({ telegramId }) => {
  const userRoot = await protobuf.load(
    "./protoBuf_files/foryou.proto",
  );

  let ForyouProto = userRoot.lookupType("Users");
  const currentTime = Date.now();

  // جستجو در مانگوس در این مورد سرعت بیشتری از ردیس دارد
  const findUser = await User.findOne({ telegramId }).select(
    "-sentLikes -receivedLikes -blockedByMe -blocksMe",
  );

  const score = await redisClient.hget(+telegramId, "score");
  const scoreNumber = score !== null ? Number(score) : 80;

  // findUser.lastSeen = 0;
  // await findUser.save();
  // await redisClient.hset(`user:${telegramId}`, "lastSeen", 0);

  if (!findUser || !findUser?.state) {
    !findUser || console.log(`User with ID ${telegramId} not found.`);
      !findUser?.state ||
      console.log(
        `User with ID ${telegramId} has no location state.`,
      );
    return;
  }

  // create user for protoBuff model
  const adaptedUser = {
    _id: findUser._id.toString(),
    telegramId: findUser.telegramId || 123,
    fullName: findUser.fullName || "",
    age: findUser.age || 123,
    gender: findUser.gender || "",
    lookingFor: findUser.lookingFor || "",
    state: findUser.state || "",
    lastSeen:
      findUser.lastSeen instanceof Date
        ? Math.floor(findUser.lastSeen.getTime() / 1000)
        : typeof findUser.lastSeen === "number"
        ? findUser.lastSeen
        : 0,
    lastUpdate:
      findUser.lastUpdate instanceof Date
        ? Math.floor(findUser.lastUpdate.getTime() / 1000)
        : typeof findUser.lastUpdate === "number"
        ? findUser.lastUpdate
        : 0,
    sleep: !!findUser.sleep,
    education: findUser.moreInformation.education || "",
    dietaryPreference:
      findUser.moreInformation.dietaryPreference || "",
    job: findUser.moreInformation.job || "",
    workout: findUser.moreInformation.workout || "",
    sleepingHabits: findUser.moreInformation.sleepingHabits || "",
    pets: findUser.moreInformation.pets || "",
    bio: findUser.moreInformation.bio || "",
    profileImages: findUser.profileImages || [],
    score: scoreNumber,
    inviteCode: findUser.inviteCode || "",
  };

  const saveToRedis = async (keyType) => {
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

    // آماده‌سازی آرایه کاربران
    let usersArray = [adaptedUser];

    // بررسی وجود داده در ردیس
    const getData = await redisClient.getBuffer(redisKey);
    if (Buffer.isBuffer(getData)) {
      try {
        const decodeBuffer = ForyouProto.decode(getData);
        // فیلتر کردن کاربر فعلی از لیست و افزودن آن به ابتدای آرایه
        const filteredUsers = decodeBuffer.users.filter(
          (f) => f._id !== adaptedUser._id,
        );
        if (filteredUsers.length > 2100) {
          usersArray = [adaptedUser, ...filteredUsers.slice(0, 1900)];
        } else {
          usersArray = [adaptedUser, ...filteredUsers];
        }
      } catch (decodeError) {
        console.error(
          "Error decoding buffer from Redis:",
          decodeError,
        );
        // در صورت خطا در decode، فقط کاربر فعلی را استفاده می‌کنیم
      }
    }

    // اعتبارسنجی داده‌ها
    const errMsg = ForyouProto.verify({ users: usersArray });
    if (errMsg) {
      console.log("Protobuf validation error:", errMsg);
      return;
    }

    // تبدیل به protobuf و ذخیره در ردیس
    const message_ = ForyouProto.create({ users: usersArray });
    const buffer = ForyouProto.encode(message_).finish();
    await redisClient.set(redisKey, buffer);
  };

  // استفاده از تابع
  await saveToRedis("city");
  await saveToRedis("global");
};

module.exports = { foryouQueueController };
