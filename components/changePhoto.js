const { default: axios } = require("axios");
const User = require("../models/User");
const { uploadImageFromUrl } = require("./uploadImageFromUrl");
const usersMap = require("../utils/usersMap");
const Pictures = require("../models/Pictures");
const fs = require("fs");

const changePhoto = async (
  ctx,
  telegramId,
  existingUser,
  redisClient,
  forYouList,
  forYouTime,
  suggestQueue,
) => {
  if (existingUser.changePhotoStep === "isCorrectProfile") {
    if (ctx?.message?.text === "بله") {
      try {
        // save in redis
        // save in redis
        await redisClient.hmset(`user:${existingUser.telegramId}`, {
          profileImages: JSON.stringify(
            existingUser.profileImages ||
              existingUser.profileImagesEdit ||
              [],
          ),
        });
        // search

        existingUser.userStep = "search";
        existingUser.profileImagesEdit = [];
        existingUser.changePhotoStep = "";
        // await existingUser.save();
        usersMap.set(telegramId, {
          time: Date.now(),
          user: existingUser,
        });

        try {
          existingUser.userStep = "search";
          usersMap.set(telegramId, {
            time: Date.now(),
            user: existingUser,
          });
          if (
            forYouList.get(telegramId) &&
            Array.isArray(forYouList.get(telegramId)) &&
            forYouList.get(telegramId).length > 10 &&
            forYouTime.get(telegramId) &&
            forYouTime.get(telegramId) + 300000 > Date.now()
          ) {
            await ctx.reply("🔎", {
              reply_markup: {
                keyboard: [
                  [
                    { text: "💌" },
                    { text: "❌" },
                    { text: "❤️" },
                    { text: "☰" },
                  ],
                ],
                resize_keyboard: true,

                is_persistent: true, // این خط را اضافه کنید
              },
            });

            const { fullName, age, state, flag, bio, profileImages } =
              forYouList.get(telegramId)[0];

            const photos = profileImages;
            // const photos = existingUser.profileImages || [];
            await ctx.replyWithPhoto(
              {
                source: fs.createReadStream(photos[0]),
              },
              {
                caption: `${fullName}, ${age}, ${state} ${
                  bio ? "\n" + bio : ""
                } `,
              },
            );
            // await ctx.replyWithMediaGroup(
            //   photos.map((photo, index) => ({
            //     type: "photo",
            //     media: photo,
            //     caption:
            //       index === 0
            //         ? `${fullName}, ${age}, ${flag + " " + state} ${
            //             bio ? "\n" + bio : ""
            //           } `
            //         : undefined,
            //   })),
            // );
          } else {
            forYouTime.set(telegramId, Date.now());
            // add to search queue
            suggestQueue.add({
              telegramId,
              user: existingUser,
            });

            await ctx.reply("🔎", {
              reply_markup: {
                keyboard: [
                  [
                    { text: "💌" },
                    { text: "❌" },
                    { text: "❤️" },
                    { text: "☰" },
                  ],
                ],
                resize_keyboard: true,
                is_persistent: true,
              },
            });

            setTimeout(async () => {
              try {
                const {
                  fullName,
                  age,
                  state,
                  flag,
                  bio,
                  profileImages,
                } = forYouList.get(telegramId)[0];

                const photos = profileImages;

                await ctx.replyWithPhoto(
                  {
                    source: fs.createReadStream(photos[0]),
                  },
                  {
                    caption: `${fullName}, ${age}, ${state} ${
                      bio ? "\n" + bio : ""
                    } `,
                  },
                );
                // const photos = existingUser.profileImages || [];
                // await ctx.replyWithMediaGroup(
                //   photos.map((photo, index) => ({
                //     type: "photo",
                //     media: photo,
                //     caption:
                //       index === 0
                //         ? `${fullName}, ${age}, ${
                //             flag + " " + state
                //           } ${bio ? "\n" + bio : ""} `
                //         : undefined,
                //   })),
                // );
              } catch (error) {
                console.log({ error });
              }
            }, 3000);
          }
        } catch (error) {
          console.log({ error });
        }

        // ctx.reply("🔍", {
        //   reply_markup: {
        //     keyboard: [
        //       [
        //         { text: "💌" },
        //         { text: "❌" },
        //         { text: "❤️" },
        //         { text: "☰" },
        //       ],
        //     ],
        //     resize_keyboard: true,
        //   },
        // });

        // ctx.replyWithPhoto(
        //   "https://pouns-storage.storage.c2.liara.space/1758644004701-4a0b00d2-f844-4e63-9923-2e3ba0de688c.jpg",
        //   {
        //     caption: "Abolfazl, 25, 🇮🇷 Tehran\njust a programmer",
        //   },
        // );
      } catch (error) {
        ctx.reply(
          "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
            "r34",
        );
      }
    } else if (ctx?.message?.text === "ویرایش پروفایلم") {
      try {
        await User.updateOne(
          { telegramId },
          { userStep: "editProfileMenu" },
        );

        existingUser.registerStep = "editProfileMenu";
        existingUser.changePhotoStep = "";
        // await existingUser.save();
        usersMap.set(telegramId, {
          time: Date.now(),
          user: existingUser,
        });

        ctx.reply(
          `1. ${"مشاهده پروفایل ها"} \n2. ${"ویرایش پروفایلم"} \n3. ${"تغییر عکس من"}`,
          {
            reply_markup: {
              keyboard: [
                [{ text: "1🚀" }, { text: "2" }, { text: "3" }],
              ],
              resize_keyboard: true,
            },
          },
        );
      } catch (error) {
        console.log({ error });
      }
    } else {
      const photos = existingUser.profileImages || [];
      const fullName = existingUser.fullName;
      const age = existingUser.age;
      const state = existingUser.state;
      const flag = existingUser.flag;
      const bio = existingUser.moreInformation.bio;

      console.log({ photos });
      console.log({ photos2: existingUser.profileImagesEdit });

      try {
        await ctx.replyWithPhoto(
          {
            source: fs.createReadStream(photos[0]),
          },
          {
            caption: `${fullName}, ${age}, ${state} ${
              bio ? "\n" + bio : ""
            } `,
          },
        );
        // await ctx.replyWithMediaGroup(
        //   photos.map((photo, index) => ({
        //     type: "photo",
        //     media: photo,
        //     caption:
        //       index === 0
        //         ? `${fullName}, ${age}, ${flag + " " + state} ${
        //             bio ? "\n" + bio : ""
        //           } `
        //         : undefined,
        //   })),
        // );
        ctx.reply("درسته ؟", {
          reply_markup: {
            keyboard: [
              [{ text: "بله" }, { text: "ویرایش پروفایلم" }],
            ],
            resize_keyboard: true,
          },
        });
      } catch (error) {
        ctx.reply(
          "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
            "r35",
        );
        console.log({ error });
      }

      return;
    }
  } else if (ctx?.message?.text === "بازگشت") {
    try {
      existingUser.userStep = "editProfileMenu";
      existingUser.profileImagesEdit = [];
      existingUser.changePhotoStep = "";
      // await existingUser.save();
      usersMap.set(telegramId, {
        time: Date.now(),
        user: existingUser,
      });

      ctx.reply(
        `1. ${"مشاهده پروفایل ها"} \n2. ${"ویرایش پروفایلم"} \n3. ${"تغییر عکس من"}`,
        {
          reply_markup: {
            keyboard: [
              [{ text: "1🚀" }, { text: "2" }, { text: "3" }],
            ],
            resize_keyboard: true,
          },
        },
      );
    } catch (error) {
      console.log({ error });
    }
  } else if (ctx.message.photo) {
    try {
      const photos = existingUser.profileImagesEdit || [];
      if (photos.length === 3) return;
      ctx.reply("⌛️");

      const fileId = ctx.message.photo.at(-1).file_id;
      const fileLink = await ctx.telegram.getFileLink(fileId);

      const imageUrl = await uploadImageFromUrl(fileLink);
      if (photos.length === 3) return;
      photos.push(imageUrl);
      await Pictures.create({
        telegramId: +telegramId || existingUser.telegramId || 0,
        url: imageUrl,
      });
      existingUser.profileImagesEdit = photos;
      // await existingUser.save();
      usersMap.set(telegramId, {
        time: Date.now(),
        user: existingUser,
      });

      // if (photos.length === 1) {
      //   ctx.reply(languageText.photoAdded1, {
      //     reply_markup: {
      //       keyboard: [
      //         [
      //           {
      //             text: "تمام ، ذخیره تصاویر ✅",
      //           },
      //         ],
      //       ],
      //       resize_keyboard: true,
      //     },
      //   });
      // } else if (photos.length === 2) {
      //   ctx.reply(languageText.photoAdded2, {
      //     reply_markup: {
      //       keyboard: [
      //         [
      //           {
      //             text: "تمام ، ذخیره تصاویر ✅",
      //           },
      //         ],
      //       ],
      //       resize_keyboard: true,
      //     },
      //   });
      // } else {
      // setTimeout(async () => {
      try {
        if (
          existingUser.profileImages.length > 0 &&
          existingUser.profileImagesEdit > 0
        ) {
          await Pictures.deleteMany({
            url: { $in: existingUser.profileImages },
          });
        }
        existingUser.profileImages = existingUser.profileImagesEdit;
        existingUser.profileImagesEdit = [];
        existingUser.changePhotoStep = "isCorrectProfile";
        await existingUser.save();
        usersMap.set(telegramId, {
          time: Date.now(),
          user: existingUser,
        });
        const photos = existingUser.profileImages || [];
        const fullName = existingUser.fullName;
        const age = existingUser.age;
        const state = existingUser.state;
        const flag = existingUser.flag;
        const bio = existingUser.moreInformation.bio;

        console.log({ photos });

        await ctx.replyWithPhoto(
          {
            source: fs.createReadStream(photos[0]),
          },
          {
            caption: `${fullName}, ${age}, ${state} ${
              bio ? "\n" + bio : ""
            } `,
          },
        );

        // await ctx.replyWithMediaGroup(
        //   photos.map((photo, index) => ({
        //     type: "photo",
        //     media: photo,
        //     caption:
        //       index === 0
        //         ? `${fullName}, ${age}, ${flag + " " + state} ${
        //             bio ? "\n" + bio : ""
        //           } `
        //         : undefined,
        //   })),
        // );
        ctx.reply("درسته ؟", {
          reply_markup: {
            keyboard: [
              [{ text: "بله" }, { text: "ویرایش پروفایلم" }],
            ],
            resize_keyboard: true,
          },
        });
      } catch (error) {
        console.log({ error });
        ctx.reply(
          "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
            "cf32",
        );
      }
      // }, 1000);

      return;
      // }

      return;
      // }
    } catch (error) {
      ctx.reply(
        "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
          "r30",
      );
      console.log({ error });
    }
  } else if (ctx?.message?.text === "تمام ، ذخیره تصاویر ✅") {
    console.log("changePhoto - 4");
    ctx.reply("⌛️");

    try {
      if (
        existingUser.profileImages.length &&
        existingUser.profileImagesEdit > 0
      ) {
        await Pictures.deleteMany({
          url: { $in: existingUser.profileImages },
        });
      }
      existingUser.profileImages = existingUser.profileImagesEdit;
      existingUser.profileImagesEdit = [];
      existingUser.changePhotoStep = "isCorrectProfile";
      // await existingUser.save();
      usersMap.set(telegramId, {
        time: Date.now(),
        user: existingUser,
      });

      const photos = existingUser.profileImages || [];
      const fullName = existingUser.fullName;
      const age = existingUser.age;
      const state = existingUser.state;
      const flag = existingUser.flag;
      const bio = existingUser.moreInformation.bio;

      console.log({ photos });

      await ctx.replyWithPhoto(
        {
          source: fs.createReadStream(photos[0]),
        },
        {
          caption: `${fullName}, ${age}, ${state} ${
            bio ? "\n" + bio : ""
          } `,
        },
      );

      // await ctx.replyWithMediaGroup(
      //   photos.map((photo, index) => ({
      //     type: "photo",
      //     media: photo,
      //     caption:
      //       index === 0
      //         ? `${fullName}, ${age}, ${flag + " " + state} ${
      //             bio ? "\n" + bio : ""
      //           } `
      //         : undefined,
      //   })),
      // );
      ctx.reply("درسته ؟", {
        reply_markup: {
          keyboard: [[{ text: "بله" }, { text: "ویرایش پروفایلم" }]],
          resize_keyboard: true,
        },
      });
    } catch (error) {
      ctx.reply(
        "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
          "r31",
      );
    }
    return;
  } else {
    existingUser.step = "photo";
    // await existingUser.save();
    usersMap.set(telegramId, {
      time: Date.now(),
      user: existingUser,
    });
    try {
      ctx.reply("عکس خود را ارسال کنید 🖼️", {
        reply_markup: {
          keyboard: [[{ text: "بازگشت" }]],
          resize_keyboard: true,
        },
      });
    } catch (error) {
      ctx.reply(
        "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
          "r32",
      );
    }
  }
};

module.exports = {
  changePhoto,
};
