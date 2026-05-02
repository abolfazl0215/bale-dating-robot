const User = require("../models/User");
const usersMap = require("../utils/usersMap.js");

const cleanupOldUsersFromMapAndSaveToDB = async () => {
     try {
        const now = Date.now();
        const thirtyMinutesInMs = 1800000; // 30 دقیقه به میلی‌ثانیه
        // const thirtyMinutesInMs = 30 * 60 * 1000; // 30 دقیقه به میلی‌ثانیه
    
        const entries = Array.from(usersMap.entries());
    
        await Promise.all(
          entries.map(async ([telegramId, userData]) => {
            const timeDifference = now - userData.time;
    
            if (timeDifference >= thirtyMinutesInMs) {
              const currentUser = userData.user;
    
              // ذخیره‌ی اطلاعات کاربر در دیتابیس
              await User.findOneAndUpdate(
                { telegramId },
                {
                  sendFakeLike: currentUser.userName || 0,
                  userName: currentUser.userName || "",
                  userStep: currentUser.userStep || "menu",
                  registerStep: currentUser.registerStep || "language",
                  editProfileStep: currentUser.editProfileStep || "age",
                  changePhotoStep: currentUser.changePhotoStep || "",
                  firstLikeTime:
                    currentUser.firstLikeTime || 1734878731629,
    
                  lastAnsweredMessage:
                    currentUser.lastAnsweredMessage || 0,
                  lastViewed: currentUser.lastViewed || 0,
    
                  ban: currentUser.ban || false,
    
                  firstLike: currentUser.firstLike || 0,
                  firstNope: currentUser.firstNope || 0,
                  giftLikeCount: currentUser.giftLikeCount || 0,
                  unavailablePv: currentUser.unavailablePv || false,
    
                  likeCount: currentUser.likeCount || 1,
                  sleep: currentUser.sleep ?? false,
                  fullName: currentUser.fullName || "",
                  age: currentUser.age != null ? +currentUser.age : 18,
                  gender: currentUser.gender || "",
                  lookingFor: currentUser.lookingFor || "",
                  state: currentUser.state || "",
                  country: currentUser.country || "",
                  flag: currentUser.flag || "",
                  language: currentUser.language || "en",
                  profileImages: currentUser.profileImages || [],
                  profileImagesEdit: currentUser.profileImagesEdit || [],
                  "moreInformation.bio": currentUser.bio || "",
                  matches: currentUser.matches || [],
                  userProfile: currentUser.userProfile || {},
                  inviteCode: currentUser.inviteCode || "",
                },
              );
    
              // حذف کاربر از Map
              usersMap.delete(telegramId);
            }
          }),
        );
    
        // console.log(
        //   `🧹 پاک‌سازی انجام شد. تعداد کاربران باقیمانده: ${usersMap.size}`,
        // );
      } catch (error) {
        console.error("❌ خطا در پاک‌سازی کاربران:", error);
      }
}

module.exports = cleanupOldUsersFromMapAndSaveToDB;