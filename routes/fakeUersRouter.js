// routes/fakeUsers.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const usersMap = require("../utils/usersMap");
const forYouList = require("../utils/forYouList");
const protobuf = require("protobufjs");

// ─── تصاویر رندوم از آواتار رایگان ───────────────────────────────────────────
const MALE_PHOTOS = Array.from(
  { length: 50 },
  (_, i) =>
    "public/uploads/1777660207645-93a344a9-1db1-438a-86aa-b4168ddbf856.jpg",
);
const FEMALE_PHOTOS = Array.from(
  { length: 50 },
  (_, i) =>
    "public/uploads/1777660207645-93a344a9-1db1-438a-86aa-b4168ddbf856.jpg",
);

// ─── اسامی فارسی رندوم ────────────────────────────────────────────────────────
const MALE_NAMES = [
  "علی",
  "محمد",
  "حسین",
  "رضا",
  "امیر",
  "سینا",
  "آرش",
  "فرهاد",
  "کیان",
  "داریوش",
  "بهروز",
  "شاهین",
  "مهران",
  "نیما",
  "پارسا",
  "آرمین",
  "کامران",
  "سامان",
  "وحید",
  "مجید",
  "پیمان",
  "شهاب",
  "ایمان",
  "صادق",
  "بابک",
  "کوروش",
  "منوچهر",
  "فریبرز",
  "ناصر",
  "جواد",
];
const FEMALE_NAMES = [
  "سارا",
  "نازنین",
  "مریم",
  "فاطمه",
  "زهرا",
  "لیلا",
  "آیدا",
  "شیدا",
  "نیلوفر",
  "پریسا",
  "الهام",
  "مهسا",
  "یاسمین",
  "گلناز",
  "رویا",
  "ندا",
  "سحر",
  "آناهیتا",
  "شقایق",
  "بهار",
  "مینا",
  "نگار",
  "درسا",
  "آرزو",
  "ترانه",
  "ملیکا",
  "سوفیا",
  "هانیه",
  "پگاه",
  "دلارام",
];

const LAST_NAMES = [
  "محمدی",
  "احمدی",
  "حسینی",
  "رضایی",
  "کریمی",
  "موسوی",
  "صادقی",
  "رحیمی",
  "جعفری",
  "علوی",
  "نجفی",
  "قاسمی",
  "حیدری",
  "مرادی",
  "غلامی",
  "سلطانی",
  "شریفی",
  "ابراهیمی",
  "عباسی",
  "زارعی",
];

const BIOS = [
  "عاشق کوهنوردی و طبیعت 🏔️",
  "موسیقی، کتاب، قهوه ☕",
  "برنامه‌نویس و گیمر 🎮",
  "دنبال آدم‌های باهوش و باحال 😄",
  "عاشق سفر و اکتشاف 🌍",
  "ورزشکار و سالم‌زیست 💪",
  "هنرمند و خلاق 🎨",
  "دانشجو | زندگی رو جدی نمیگیرم 😄",
  "آشپز حرفه‌ای خانگی 🍳",
  "فیلم‌باز و سینمادوست 🎬",
  "یوگا | مدیتیشن | آرامش 🧘",
  "عاشق حیوانات 🐾",
  null,
  null,
  null, // برخی کاربران بایو ندارند
];

// ─── شهرهای تهران ─────────────────────────────────────────────────────────────
const TEHRAN_DISTRICTS = [
  "Tehran",
  "Tehran",
  "Tehran",
  "Tehran", // بیشتر تهران
];

// ─── تابع رندوم ───────────────────────────────────────────────────────────────
function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function generateFakeTelegramId() {
  // شناسه‌های فیک منفی تا با کاربران واقعی تداخل نداشته باشند
  return -(Math.floor(Math.random() * 9000000) + 1000000);
}
function generateFakeInviteCode(telegramId) {
  return `fake_${Math.abs(telegramId).toString(36)}`;
}

// ─── ساخت یک کاربر فیک ───────────────────────────────────────────────────────
function buildFakeUser(index) {
  const gender = index % 2 === 0 ? "male" : "female";
  const names = gender === "male" ? MALE_NAMES : FEMALE_NAMES;
  const photos = gender === "male" ? MALE_PHOTOS : FEMALE_PHOTOS;

  const firstName = rand(names);
  const lastName = rand(LAST_NAMES);
  const fullName = `${firstName} ${lastName}`;
  const age = randInt(18, 45);
  const photo1 = rand(photos);
  const photo2 = rand(photos);
  const telegramId = generateFakeTelegramId();
  const bio = rand(BIOS);

  return {
    telegramId,
    userName: `fake_user_${Math.abs(telegramId)}`,
    inviteCode: generateFakeInviteCode(telegramId),
    inviteBy: null,
    userStep: "search",
    registerStep: "isCorrectProfile",
    fullName,
    age,
    gender,
    lookingFor: gender === "male" ? "female" : "male",
    country: "Iran",
    flag: "🇮🇷",
    state: "Tehran",
    language: "fa",
    profileImages: [photo1, photo2],
    bio: bio || "",
    sleep: false,
    ban: false,
    lastSeen: Date.now(),
    lastUpdate: Date.now(),
    createdAt: Date.now(),
    firstLike: 0,
    firstNope: 0,
    giftLikeCount: 0,
    likeCount: 1,
    firstLikeTime: Date.now(),
    unavailablePv: true, // کاربر فیک پیام خصوصی ندارد
    isFake: true,
  };
}

// ─── آپدیت Redis با کاربران فیک ──────────────────────────────────────────────
async function updateRedisWithFakeUsers(fakeUsers, redisClient) {
  try {
    const protoRoot = await protobuf.load(
      "./protoBuf_files/foryou.proto",
    );
    const ForyouProto = protoRoot.lookupType("Users");

    // ذخیره هر کاربر فیک در redis hash
    for (const user of fakeUsers) {
      await redisClient.hmset(`user:${user.telegramId}`, {
        lastUpdate: Date.now().toString(),
        lastSeen: Date.now().toString(),
        language: user.language,
        age: user.age.toString(),
        gender: user.gender,
        lookingFor: user.lookingFor,
        country: user.country,
        flag: user.flag,
        state: user.state,
        fullName: user.fullName,
        bio: user?.bio || "",
        profileImages: JSON.stringify(user.profileImages),
        sleep: "false",
        isFake: "true",
      });
    }

    // آپدیت لیست globalUsers برای هر جنسیت
    for (const gender of ["male", "female"]) {
      const usersOfGender = fakeUsers.filter(
        (u) => u.gender === gender,
      );

      // فرمت proto برای foryou
      const protoUsers = usersOfGender.map((u) => ({
        telegramId: u.telegramId.toString(),
        fullName: u.fullName,
        age: u.age,
        gender: u.gender,
        country: u.country,
        flag: u.flag,
        state: u.state,
        bio: u?.bio || "",
        profileImages: u.profileImages,
        inviteCode: u.inviteCode,
        userName: u.userName || "",
        sleep: false,
      }));

      // دریافت لیست فعلی از Redis
      const existingBuffer = await redisClient.getBuffer(
        `globalUsers:${gender}`,
      );
      let existingUsers = [];

      if (Buffer.isBuffer(existingBuffer)) {
        try {
          const decoded = ForyouProto.decode(existingBuffer);
          existingUsers = decoded.users || [];
        } catch (e) {
          existingUsers = [];
        }
      }

      // ترکیب کاربران فیک با لیست موجود (بدون تکرار)
      const existingIds = new Set(
        existingUsers.map((u) => u.telegramId?.toString()),
      );
      const newUsers = protoUsers.filter(
        (u) => !existingIds.has(u.telegramId?.toString()),
      );
      const mergedUsers = [...newUsers, ...existingUsers];

      const message = ForyouProto.create({ users: mergedUsers });
      const buffer = ForyouProto.encode(message).finish();
      await redisClient.set(`globalUsers:${gender}`, buffer);

      // آپدیت city:gender:tehran
      const cityKey = `city:${gender}:tehran`;
      const existingCityBuffer = await redisClient.getBuffer(cityKey);
      let existingCityUsers = [];

      if (Buffer.isBuffer(existingCityBuffer)) {
        try {
          const decoded = ForyouProto.decode(existingCityBuffer);
          existingCityUsers = decoded.users || [];
        } catch (e) {
          existingCityUsers = [];
        }
      }

      const existingCityIds = new Set(
        existingCityUsers.map((u) => u.telegramId?.toString()),
      );
      const newCityUsers = protoUsers.filter(
        (u) => !existingCityIds.has(u.telegramId?.toString()),
      );
      const mergedCityUsers = [...newCityUsers, ...existingCityUsers];

      const cityMessage = ForyouProto.create({
        users: mergedCityUsers,
      });
      const cityBuffer = ForyouProto.encode(cityMessage).finish();
      await redisClient.set(cityKey, cityBuffer);
    }

    console.log("✅ Redis updated with fake users");
  } catch (error) {
    console.error("❌ Error updating Redis with fake users:", error);
    throw error;
  }
}

// ─── آپدیت forYouList در حافظه ───────────────────────────────────────────────
function updateInMemoryForYouList(fakeUsers) {
  // این فانکشن می‌تواند برای کاربران آنلاین فعلی هم اعمال شود
  // اما معمولاً forYouList به‌صورت خودکار از Redis پر می‌شود
  // فقط کاربران فیک را به usersMap اضافه می‌کنیم تا در دسترس باشند
  for (const user of fakeUsers) {
    usersMap.set(user.telegramId, {
      user,
      time: Date.now(),
    });
  }
  console.log(`✅ ${fakeUsers.length} fake users added to usersMap`);
}

// ─── روت اصلی POST /admin/create-fake-users ──────────────────────────────────
router.post("/fakeUsers", async (req, res) => {
  const { count = 200, secretKey } = req.body;

  // امنیت ساده
  if (secretKey !== process.env.ADMIN_SECRET_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (count > 500) {
    return res.status(400).json({ error: "Max 500 users at a time" });
  }

  try {
    const redisClient = req.redisClient;
    const fakeUsers = [];

    // ساخت کاربران فیک
    for (let i = 0; i < count; i++) {
      fakeUsers.push(buildFakeUser(i));
    }

    // ذخیره در MongoDB
    const saved = await User.insertMany(fakeUsers, {
      ordered: false,
    }).catch((err) => {
      // ادامه حتی اگر برخی تکراری بودند
      console.warn("Some duplicate users skipped:", err.message);
      return err.insertedDocs || [];
    });

    // آپدیت Redis
    await updateRedisWithFakeUsers(fakeUsers, redisClient);

    // آپدیت حافظه RAM
    updateInMemoryForYouList(fakeUsers);

    return res.json({
      success: true,
      message: `✅ ${fakeUsers.length} fake users created`,
      maleCount: fakeUsers.filter((u) => u.gender === "male").length,
      femaleCount: fakeUsers.filter((u) => u.gender === "female")
        .length,
      sampleUsers: fakeUsers.slice(0, 3).map((u) => ({
        telegramId: u.telegramId,
        fullName: u.fullName,
        age: u.age,
        gender: u.gender,
        photos: u.profileImages,
      })),
    });
  } catch (error) {
    console.error("Error creating fake users:", error);
    return res.status(500).json({ error: error.message });
  }
});

// ─── روت GET /admin/fake-users-count ─────────────────────────────────────────
router.get("/admin/fake-users-count", async (req, res) => {
  const { secretKey } = req.query;
  if (secretKey !== process.env.ADMIN_SECRET_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    // چون فیلد isFake در اسکیما نداریم، با userName fake_ شمارش می‌کنیم
    const count = await User.countDocuments({
      userName: { $regex: /^fake_user_/ },
    });
    return res.json({ fakeUserCount: count });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ─── روت DELETE /admin/delete-fake-users ─────────────────────────────────────
router.delete("/admin/delete-fake-users", async (req, res) => {
  const { secretKey } = req.body;
  if (secretKey !== process.env.ADMIN_SECRET_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const redisClient = req.redisClient;

    // پیدا کردن همه کاربران فیک
    const fakeUsers = await User.find({
      userName: { $regex: /^fake_user_/ },
    });

    const fakeIds = fakeUsers.map((u) => u.telegramId);

    // حذف از MongoDB
    const deleted = await User.deleteMany({
      userName: { $regex: /^fake_user_/ },
    });

    // حذف از usersMap
    for (const id of fakeIds) {
      usersMap.delete(id);
    }

    // حذف از forYouList های موجود
    for (const [key, list] of forYouList.entries()) {
      if (Array.isArray(list)) {
        const filtered = list.filter(
          (u) => !fakeIds.includes(+u.telegramId),
        );
        forYouList.set(key, filtered);
      }
    }

    // پاک کردن Redis globalUsers و city (بازسازی از صفر)
    for (const gender of ["male", "female"]) {
      await redisClient.del(`globalUsers:${gender}`);
      await redisClient.del(`city:${gender}:tehran`);
    }

    // حذف Redis hash های کاربران فیک
    for (const id of fakeIds) {
      await redisClient.del(`user:${id}`);
    }

    return res.json({
      success: true,
      deletedCount: deleted.deletedCount,
      message: `✅ ${deleted.deletedCount} fake users deleted`,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
