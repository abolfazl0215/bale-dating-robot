const { redisClient } = require("../config/redis");
const User = require("../models/User");
const protobuf = require("protobufjs");

const newLikeQueueController = async ({ telegramId, liker }) => {
  // ست کردن کاربران اولیه در forYou
  const getData = await redisClient.getBuffer(`newLikes`);

  if (Buffer.isBuffer(getData)) {
    const userRoot = await protobuf.load(
      "./protoBuf_files/newLike.proto",
    );

    let NewLikeProto = userRoot.lookupType("Users");
    const decodedMessage = NewLikeProto.decode(getData);
    let usersArrayFromRedis = decodedMessage.users || [];

    const findLike = usersArrayFromRedis.find(
      (f) => +f.telegramId === telegramId,
    );

    if (findLike) {
      if (findLike) {
        const findLiker = findLike.likers.find(
          (f) => +f.telegramId === +liker.telegramId,
        );
        if (!findLiker) {
          findLike.likers.push({
            _id: liker._id,
            telegramId: liker.telegramId,
            fullName: liker.fullName,
            userName: liker.userName,
            age: liker.age,
            gender: liker.gender,
            lookingFor: liker.lookingFor,
            state: liker.state,
            lastSeen: liker.lastSeen,
            lastUpdate: liker.lastUpdate,
            sleep: liker.sleep,
            education: liker.education,
            dietaryPreference: liker.dietaryPreference,
            job: liker.job,
            workout: liker.workout,
            sleepingHabits: liker.sleepingHabits,
            pets: liker.pets,
            bio: liker.bio,
            profileImages: liker.profileImages,
            inviteCode: liker.inviteCode,
          });
        }
      }
    } else {
      usersArrayFromRedis.push({
        telegramId,
        likers: [
          {
            _id: liker._id,
            telegramId: liker.telegramId,
            fullName: liker.fullName,
            userName: liker.userName,
            age: liker.age,
            gender: liker.gender,
            lookingFor: liker.lookingFor,
            state: liker.state,
            lastSeen: liker.lastSeen,
            lastUpdate: liker.lastUpdate,
            sleep: liker.sleep,
            education: liker.education,
            dietaryPreference: liker.dietaryPreference,
            job: liker.job,
            workout: liker.workout,
            sleepingHabits: liker.sleepingHabits,
            pets: liker.pets,
            bio: liker.bio,
            profileImages: liker.profileImages,
            inviteCode: liker.inviteCode,
          },
        ],
      });
    }


    // اعتبارسنجی داده‌ها
    const errMsg = NewLikeProto.verify({
      users: usersArrayFromRedis,
    });
    if (errMsg) {
      console.log("Protobuf validation error:", errMsg);
      return;
    }

    // تبدیل به protobuf و ذخیره در ردیس
    const message_ = NewLikeProto.create({
      users: usersArrayFromRedis,
    });
    const buffer = NewLikeProto.encode(message_).finish();
    await redisClient.set("newLikes", buffer);
  } else {
    const likers = [
      {
        telegramId,
        likers: [
          {
            _id: liker._id,
            telegramId: liker.telegramId,
            fullName: liker.fullName,
            userName: liker.userName,
            age: liker.age,
            gender: liker.gender,
            lookingFor: liker.lookingFor,
            state: liker.state,
            lastSeen: liker.lastSeen,
            lastUpdate: liker.lastUpdate,
            sleep: liker.sleep,
            education: liker.education,
            dietaryPreference: liker.dietaryPreference,
            job: liker.job,
            workout: liker.workout,
            sleepingHabits: liker.sleepingHabits,
            pets: liker.pets,
            bio: liker.bio,
            profileImages: liker.profileImages,
            inviteCode: liker.inviteCode,
          },
        ],
      },
    ];

    const userRoot = await protobuf.load(
      "./protoBuf_files/newLike.proto",
    );

    let NewLikeProto = userRoot.lookupType("Users");
    const message_ = NewLikeProto.create({ users: likers });
    const buffer = NewLikeProto.encode(message_).finish();
    await redisClient.set("newLikes", buffer);
  }
};

module.exports = { newLikeQueueController };
