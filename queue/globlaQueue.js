const protobuf = require("protobufjs");
const { redisClient } = require("../config/redis");
const User = require("../models/User");
const forYouList = require("../utils/forYouList");

function addToTop(list, item) {
  const index = list.indexOf(item);
  if (index !== -1) {
    list.splice(index, 1); // حذف مورد تکراری
  }
  list.unshift(item); // افزودن به ابتدای آرایه
}

const globalOperationsQueueController = async ({ type, data }) => {
  if (type === "like") {
    const { telegramId, targetId, fullItem } = data;

    try {
      const profileViewCountStr =
        (await redisClient.hget(
          `user:${targetId}`,
          "profileViewCount",
        )) || "0";
      const likesReceivedCountStr =
        (await redisClient.hget(
          `user:${targetId}`,
          "likesReceivedCount",
        )) || "0";
      const matchesCountStr =
        (await redisClient.hget(
          `user:${targetId}`,
          "matchesCount",
        )) || "0";

      const updatedProfileViewCount =
        parseInt(profileViewCountStr) + 1;
      const updatedLikesReceivedCount =
        parseInt(likesReceivedCountStr) + 1;

      await redisClient.hset(
        `user:${targetId}`,
        "profileViewCount",
        updatedProfileViewCount.toString(),
      );

      await redisClient.hset(
        `user:${targetId}`,
        "likesReceivedCount",
        updatedLikesReceivedCount.toString(),
      );

      // محاسبه امتیاز
      let RawScore = Math.round(
        Math.max(
          0,
          Math.min(
            100,
            ((updatedLikesReceivedCount +
              parseInt(matchesCountStr) * 5) /
              Math.max(updatedProfileViewCount, 1)) *
              100,
          ),
        ),
      );

      

      // ذخیره امتیاز
      await redisClient.hset(
        `user:${targetId}`,
        "score",
        RawScore.toString(),
      );
    } catch (error) {
      console.log({ error });
    }

    try {
      const likesStr = await redisClient.hget(
        `user:${telegramId}`,
        "likes",
      );
      const viewedStr = await redisClient.hget(
        `user:${telegramId}`,
        "viewed",
      );

      let likes, viewed;
      try {
        likes = likesStr ? JSON.parse(likesStr) : [];
      } catch {
        likes = [];
      }
      try {
        viewed = viewedStr ? JSON.parse(viewedStr) : [];
      } catch {
        viewed = [];
      }

      // const currentItem = forYouList.get(telegramId)?.[0]?.telegramId
      //   ? +forYouList.get(telegramId)?.[0]?.telegramId
      //   : 0;


      if (targetId) {
        // likes.unshift(currentItem);
        // viewed.unshift(currentItem);

        addToTop(likes, +targetId);
        addToTop(viewed, +targetId);

        likes = likes.slice(0, 300);
        viewed = viewed.slice(0, 300);

        await redisClient.hmset(`user:${telegramId}`, {
          likes: JSON.stringify(likes),
          viewed: JSON.stringify(viewed),
        });
      }
    } catch (error) {
      console.error("خطا در ذخیره likes/viewed:", error);
    }

    // برای کاربر مقصد
    try {
      if (targetId) {
        const receiveLikesStr = await redisClient.hget(
          `user:${targetId}`,
          "receiveLikes",
        );
        const viewMyProfileStr = await redisClient.hget(
          `user:${targetId}`,
          "viewMyProfile",
        );

        let receiveLikes;
        try {
          receiveLikes = receiveLikesStr
            ? JSON.parse(receiveLikesStr)
            : [];
        } catch {
          receiveLikes = [];
        }

        // شمارنده بازدید
        let viewMyProfile;
        try {
          viewMyProfile = viewMyProfileStr
            ? parseInt(viewMyProfileStr, 10)
            : 0;
          if (isNaN(viewMyProfile)) viewMyProfile = 0;
        } catch {
          viewMyProfile = 0;
        }

        fullItem.seen = false;
        receiveLikes.unshift(fullItem);
        viewMyProfile++;

        receiveLikes = receiveLikes.slice(0, 300);

        await redisClient.hmset(`user:${targetId}`, {
          receiveLikes: JSON.stringify(receiveLikes),
          viewMyProfile: viewMyProfile.toString(), // شمارنده عددی ذخیره بشه
        });
      }
    } catch (error) {
      console.error(
        "خطا در ذخیره receiveLikes/viewMyProfile:",
        error,
      );
    }
  } else if (type === "nope") {
    const { telegramId, targetId } = data;
    try {
      const profileViewCountStr =
        (await redisClient.hget(
          `user:${targetId}`,
          "profileViewCount",
        )) || "0";
      const likesReceivedCountStr =
        (await redisClient.hget(
          `user:${targetId}`,
          "likesReceivedCount",
        )) || "0";
      const matchesCountStr =
        (await redisClient.hget(
          `user:${targetId}`,
          "matchesCount",
        )) || "0";

      const updatedProfileViewCount =
        parseInt(profileViewCountStr) + 1;
      const updatedLikesReceivedCount = parseInt(
        likesReceivedCountStr,
      );

      await redisClient.hset(
        `user:${targetId}`,
        "profileViewCount",
        updatedProfileViewCount.toString(),
      );

      await redisClient.hset(
        `user:${targetId}`,
        "likesReceivedCount",
        updatedLikesReceivedCount.toString(),
      );

      // محاسبه امتیاز
      let RawScore = Math.round(
        Math.max(
          0,
          Math.min(
            100,
            ((updatedLikesReceivedCount +
              parseInt(matchesCountStr) * 5) /
              Math.max(updatedProfileViewCount, 1)) *
              100,
          ),
        ),
      );



      // ذخیره امتیاز
      await redisClient.hset(
        `user:${targetId}`,
        "score",
        RawScore.toString(),
      );
    } catch (error) {
      console.log({ error });
    }

    try {
      const viewedStr = await redisClient.hget(
        `user:${telegramId}`,
        "viewed",
      );

      let viewed;
      try {
        viewed = viewedStr ? JSON.parse(viewedStr) : [];
      } catch {
        viewed = [];
      }

      if (targetId) {
        // viewed.unshift(+targetId);

        addToTop(viewed, +targetId);

        viewed = viewed.slice(0, 300);

        await redisClient.hset(`user:${telegramId}`, {
          viewed: JSON.stringify(viewed),
        });
      }
    } catch (error) {
      console.error("خطا در ذخیره likes/viewed:", error);
    }

    // برای کاربر مقصد
    try {
      if (targetId) {
        const viewMyProfileStr = await redisClient.hget(
          `user:${targetId}`,
          "viewMyProfile",
        );

        // شمارنده بازدید
        let viewMyProfile;
        try {
          viewMyProfile = viewMyProfileStr
            ? parseInt(viewMyProfileStr, 10)
            : 0;
          if (isNaN(viewMyProfile)) viewMyProfile = 0;
        } catch {
          viewMyProfile = 0;
        }

        viewMyProfile++;

        await redisClient.hset(`user:${targetId}`, {
          viewMyProfile: viewMyProfile.toString(), // شمارنده عددی ذخیره بشه
        });
      }
    } catch (error) {
      console.error(
        "خطا در ذخیره receiveLikes/viewMyProfile:",
        error,
      );
    }
  }
};

module.exports = { globalOperationsQueueController };
