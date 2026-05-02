const { redisClient } = require("../config/redis");
const User = require("../models/User");
const protobuf = require("protobufjs");
const forYouList = require("../utils/forYouList");

const suggestQueueController = async ({ telegramId, user }) => {
  const { lookingFor, state, gender } = user;

  // تعیین جنسیت مورد جستجو
  let lookFor;
  if (lookingFor === "noMatter") {
    // اگر فرقی نمی‌کند، جنسیت مخالف خودش را انتخاب می‌کنیم
    lookFor = gender === "male" ? "female" : "male";
  } else {
    lookFor = lookingFor;
  }

  // بارگذاری Proto Schema
  const userRoot = await protobuf.load(
    "./protoBuf_files/foryou.proto",
  );
  const ForyouProto = userRoot.lookupType("Users");

  // دریافت کاربران از شهر
  const getData = await redisClient.getBuffer(
    `city:${lookFor.toLowerCase()}:${state.toLowerCase()}`,
  );

  let usersArrayFromRedis = [];

  // دیکد کردن داده‌های اصلی
  if (Buffer.isBuffer(getData)) {
    const decodedMessage = ForyouProto.decode(getData);
    usersArrayFromRedis = decodedMessage.users || [];
  }

  // اگر noMatter بود، جنسیت دوم را هم اضافه می‌کنیم
  if (lookingFor === "noMatter") {
    const oppositeGender = lookFor === "male" ? "female" : "male";
    const getData2 = await redisClient.getBuffer(
      `city:${oppositeGender.toLowerCase()}:${state.toLowerCase()}`,
    );

    if (Buffer.isBuffer(getData2)) {
      const decodedMessage2 = ForyouProto.decode(getData2);
      const usersArrayFromRedis2 = decodedMessage2.users || [];

      // merge به صورت یکی در میان
      const merged = [];
      const maxLength = Math.max(
        usersArrayFromRedis.length,
        usersArrayFromRedis2.length,
      );

      for (let i = 0; i < maxLength; i++) {
        if (usersArrayFromRedis[i] !== undefined) {
          merged.push(usersArrayFromRedis[i]);
        }
        if (usersArrayFromRedis2[i] !== undefined) {
          merged.push(usersArrayFromRedis2[i]);
        }
      }

      usersArrayFromRedis = merged;
    }
  }

  // اگر کاربران کم بودند، از global استفاده کن
  if (usersArrayFromRedis.length < 100) {
    const getDataGlobal = await redisClient.getBuffer(
      `globalUsers:${lookFor.toLowerCase()}`,
    );

    if (Buffer.isBuffer(getDataGlobal)) {
      const decodedMessageGlobal = ForyouProto.decode(getDataGlobal);
      const globalUsers = decodedMessageGlobal.users || [];

      // حذف تکراری‌ها با Map
      const uniqueUsers = Array.from(
        new Map(
          [...usersArrayFromRedis, ...globalUsers].map((item) => [
            item.telegramId,
            item,
          ]),
        ).values(),
      );

      usersArrayFromRedis = uniqueUsers;
    }
  }

  // دریافت لیست viewed
  const getViewed = await redisClient.hget(
    `user:${+telegramId}`,
    "viewed",
  );
  const viewed = getViewed ? JSON.parse(getViewed) : [];
  const viewedSet = new Set(viewed.map((id) => +id)); // برای جستجوی سریع‌تر

  // console.log({ viewed });

  // فیلتر کردن کاربران خواب و خود کاربر
  let filteredUsers = usersArrayFromRedis
    .filter((item) => !item.sleep && +item.telegramId !== +telegramId)
    .slice(0, 1000);

  // جداسازی به دیده شده و دیده نشده
  const notViewed = [];
  const viewedUsers = [];

  filteredUsers.forEach((user) => {
    if (viewedSet.has(+user.telegramId)) {
      viewedUsers.push(user);
    } else {
      notViewed.push(user);
    }
  });

  // مرتب‌سازی هر گروه بر اساس score
  const sortByScore = (arr) => {
    return arr.sort((a, b) => {
      const scoreA = Number.isFinite(a.score) ? a.score : -Infinity;
      const scoreB = Number.isFinite(b.score) ? b.score : -Infinity;
      return scoreB - scoreA;
    });
  };

  const sortedNotViewed = sortByScore(notViewed);
  const sortedViewed = sortByScore(viewedUsers);

  // ترکیب: ابتدا دیده نشده‌ها، سپس دیده شده‌ها
  const finalList = [...sortedNotViewed, ...sortedViewed];

  // ذخیره در forYouList
  forYouList.set(telegramId, finalList.slice(0, 200));

  // console.log({
  //   totalUsers: usersArrayFromRedis.length,
  //   notViewedCount: sortedNotViewed.length,
  //   viewedCount: sortedViewed.length,
  //   finalCount: finalList.length,
  // });

  return {
    success: true,
    count: finalList.length,
  };
};

module.exports = { suggestQueueController };

// const { redisClient } = require("../config/redis");
// const User = require("../models/User");
// const protobuf = require("protobufjs");
// const forYouList = require("../utils/forYouList");

// const suggestQueueController = async ({ telegramId, user }) => {
//   const { lookingFor, state, gender } = user;

//   let lookFor;
//   if (lookingFor === "noMatter") {
//     if (gender === "male") {
//       lookFor = "female";
//     } else {
//       lookFor = "male";
//     }
//   } else {
//     lookFor = lookingFor;
//   }

//   // ست کردن کاربران اولیه در forYou
//   const getData = await redisClient.getBuffer(
//     `city:${lookFor.toLowerCase()}:${state.toLowerCase()}`,
//   );

//   let getData2;
//   if (lookingFor === "noMatter") {
//     getData2 = await redisClient.getBuffer(
//       `city:${
//         lookFor.toLowerCase() === "male" ? "female" : "male"
//       }:${state.toLowerCase()}`,
//     );
//   }

//   if (Buffer.isBuffer(getData)) {
//     const userRoot = await protobuf.load(
//       "./protoBuf_files/foryou.proto",
//     );

//     let ForyouProto = userRoot.lookupType("Users");
//     const decodedMessage = ForyouProto.decode(getData);
//     let usersArrayFromRedis = decodedMessage.users || [];

//     if (lookingFor === "noMatter" && Buffer.isBuffer(getData2)) {
//       const decodedMessage2 = ForyouProto.decode(getData2);
//       const usersArrayFromRedis2 = decodedMessage2.users || [];

//       const merged = [];
//       const maxLength = Math.max(
//         usersArrayFromRedis.length,
//         usersArrayFromRedis2.length,
//       );

//       for (let i = 0; i < maxLength; i++) {
//         if (usersArrayFromRedis[i] !== undefined)
//           merged.push(usersArrayFromRedis[i]);
//         if (usersArrayFromRedis2[i] !== undefined)
//           merged.push(usersArrayFromRedis2[i]);
//       }

//       usersArrayFromRedis = merged;
//     }

//     if (usersArrayFromRedis.length < 100) {
//       const getDataGlobal = await redisClient.getBuffer(
//         `globalUsers:${lookFor.toLowerCase()}`,
//       );
//       if (Buffer.isBuffer(getDataGlobal)) {
//         const decodedMessage2 = ForyouProto.decode(getDataGlobal);
//         const result = Array.from(
//           new Map(
//             [...usersArrayFromRedis, ...decodedMessage2.users].map(
//               (item) => [item.telegramId, item],
//             ),
//           ).values(),
//         );
//         usersArrayFromRedis = result || [];
//       }
//     } else {
//     }

//     const getViewed = await redisClient.hget(
//       `user:${+telegramId}`,
//       "viewed",
//     );

//     const viewed = getViewed ? JSON.parse(getViewed) : [];

//     const subArray = usersArrayFromRedis.slice(0, 1000);

//     subArray.sort((a, b) => {
//       const scoreA = Number.isFinite(a.score) ? a.score : -Infinity;
//       const scoreB = Number.isFinite(b.score) ? b.score : -Infinity;
//       return scoreB - scoreA;
//     });

//     console.log({ viewed });

//     const sorted = subArray.sort((a, b) => {
//       const aExists = viewed.includes(+a.telegramId);
//       const bExists = viewed.includes(+b.telegramId);
//       return aExists - bExists; // false(0) قبل از true(1)
//     });

//     const filtered = sorted.filter((item) => !item.sleep);

//     forYouList.set(telegramId, filtered.slice(0, 200));
//   }
// };

// module.exports = { suggestQueueController };
