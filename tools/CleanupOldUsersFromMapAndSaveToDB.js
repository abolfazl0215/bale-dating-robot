const User = require("../models/User");
const usersMap = require("../utils/usersMap.js");

const cleanupOldUsersFromMapAndSaveToDB = async () => {
  try {
    const now = Date.now();
    const thirtyMinutesInMs = 30 * 60 * 1000;

    const entries = Array.from(usersMap.entries());

    await Promise.all(
      entries.map(async ([telegramId, userData]) => {
        const timeDifference = now - userData.time;

        if (timeDifference >= thirtyMinutesInMs) {
          const currentUser = userData.user;

          try {
            await User.findOneAndUpdate(
              { telegramId: Number(telegramId) },
              {
                $set: {
                  userName: currentUser.userName ?? "",
                  userStep: currentUser.userStep ?? "menu",
                  registerStep:
                    currentUser.registerStep ?? "language",
                  editProfileStep:
                    currentUser.editProfileStep ?? "age",
                  changePhotoStep: currentUser.changePhotoStep ?? "",

                  firstLikeTime:
                    currentUser.firstLikeTime ?? Date.now(),

                  lastAnsweredMessage:
                    currentUser.lastAnsweredMessage ?? 0,
                  lastViewed: currentUser.lastViewed ?? 0,
                  lastViewedByInviteCode:
                    currentUser.lastViewedByInviteCode ?? 0,

                  ban: currentUser.ban ?? false,
                  firstLike: currentUser.firstLike ?? 0,
                  firstNope: currentUser.firstNope ?? 0,
                  giftLikeCount: currentUser.giftLikeCount ?? 0,
                  unavailablePv: currentUser.unavailablePv ?? false,

                  likeCount: currentUser.likeCount ?? 1,

                  sleep: currentUser.sleep ?? false,
                  fullName: currentUser.fullName ?? "",
                  age:
                    currentUser.age && currentUser.age != null
                      ? Number(currentUser.age)
                      : 18,
                  gender: currentUser.gender ?? "",
                  lookingFor: currentUser.lookingFor ?? "",
                  state: currentUser.state ?? "",

                  language: currentUser.language ?? "en",
                  profileImages: currentUser.profileImages ?? [],
                  profileImagesEdit:
                    currentUser.profileImagesEdit ?? [],
                  bio: currentUser.bio ?? "",
                  matches: currentUser.matches ?? [],

                  blockedByMe: currentUser.blockedByMe ?? [],
                  blocksMe: currentUser.blocksMe ?? [],

                  inviteCode: currentUser.inviteCode ?? "",
                },
              },
              { upsert: true, returnDocument: "after" },
            );

            usersMap.delete(telegramId);
          } catch (error) {
            console.log(error);
          }
        }
      }),
    );

    console.log(
      `🧹 پاک‌سازی انجام شد. تعداد کاربران باقیمانده: ${usersMap.size}`,
    );
  } catch (error) {
    console.error("❌ خطا در پاک‌سازی کاربران:", error);
  }
};

module.exports = cleanupOldUsersFromMapAndSaveToDB;
