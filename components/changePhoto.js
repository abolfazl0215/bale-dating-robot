const axios = require("axios");
const User = require("../models/User");
const { uploadImageFromUrl } = require("./uploadImageFromUrl");
const usersMap = require("../utils/usersMap");
const Pictures = require("../models/Pictures");
const fs = require("fs");
const { reply } = require("../telegram_methods/reply");
const { requestToFillSuggestQueue } = require("../config/redis");
const { checkUrl } = require("../utils/checkUrl");

const changePhoto = async (
  ctx,
  next,
  telegramId,
  existingUser,
  redisClient,
  forYouList,
  forYouTime,
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
            // await ctx.reply("🔎", {
            //   reply_markup: {
            //     keyboard: [
            //       [
            //         { text: "☰" },
            //         { text: "❤️" },
            //         { text: "❌" },
            //         { text: "💌" },
            //       ],
            //     ],
            //     resize_keyboard: true,

            //     is_persistent: true, // این خط را اضافه کنید
            //   },
            // });
            await reply(ctx, next, redisClient, "🔎", [
              [
                { text: "☰" },
                { text: "❤️" },
                { text: "❌" },
                { text: "💌" },
              ],
            ]);

            const { fullName, age, state, flag, bio, profileImages } =
              forYouList.get(telegramId)[0];

            const photos = profileImages;
            // const photos = existingUser.profileImages || [];
            // const buffer = await getPic(photos[0]);
            try {
              await ctx.replyWithPhoto(
                checkUrl(photos[0]),
                // {
                //   source:
                //     fs.existsSync(photos[0]) &&
                //     fs.createReadStream(photos[0]),
                // },
                {
                  caption: `${fullName}, ${age}, ${state} ${
                    bio ? "\n" + bio : ""
                  } `,
                },
              );
            } catch (e) {
              try {
                // await ctx.reply(
                //   `${fullName}, ${age}, ${state} ${
                //     bio ? "\n" + bio : ""
                //   } `,
                // );
                await reply(
                  ctx,
                  next,
                  redisClient,
                  `${fullName}, ${age}, ${state} ${
                    bio ? "\n" + bio : ""
                  } `,
                );
              } catch (error) {
                console.log(error);
              }
            }
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
            requestToFillSuggestQueue.add({
              telegramId,
              user: existingUser,
            });

            try {
              // await ctx.reply("🔎", {
              //   reply_markup: {
              //     keyboard: [
              //       [
              //         { text: "☰" },
              //         { text: "❤️" },
              //         { text: "❌" },
              //         { text: "💌" },
              //       ],
              //     ],
              //     resize_keyboard: true,
              //     is_persistent: true,
              //   },
              // });
              await reply(ctx, next, redisClient, "🔎", [
                [
                  { text: "☰" },
                  { text: "❤️" },
                  { text: "❌" },
                  { text: "💌" },
                ],
              ]);
            } catch (error) {
              console.log(error);
            }

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
                // const buffer = await getPic(photos[0]);

                try {
                  await ctx.replyWithPhoto(
                    checkUrl(photos[0]),
                    // {
                    //   source:
                    //     fs.existsSync(photos[0]) &&
                    //     fs.createReadStream(photos[0]),
                    // },
                    {
                      caption: `${fullName}, ${age}, ${state} ${
                        bio ? "\n" + bio : ""
                      } `,
                    },
                  );
                } catch (e) {
                  try {
                    // await ctx.reply(
                    //   `${fullName}, ${age}, ${state} ${
                    //     bio ? "\n" + bio : ""
                    //   } `,
                    // );
                    await reply(
                      ctx,
                      next,
                      redisClient,
                      `${fullName}, ${age}, ${state} ${
                        bio ? "\n" + bio : ""
                      } `,
                    );
                  } catch (error) {
                    console.log(error);
                  }
                }
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

        // await ctx.replyWithPhoto(
        //   "https://pouns-storage.storage.c2.liara.space/1758644004701-4a0b00d2-f844-4e63-9923-2e3ba0de688c.jpg",
        //   {
        //     caption: "Abolfazl, 25, 🇮🇷 Tehran\njust a programmer",
        //   },
        // );
      } catch (error) {
        try {
          // await ctx.reply(
          //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
          //     "r34",
          // );
          await reply(
            ctx,
            next,
            redisClient,
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو) y823",
          );
        } catch (error) {
          console.log(error);
        }
      }
    } else if (ctx?.message?.text === "ویرایش پروفایلم") {
      try {
        // await User.updateOne(
        //   { telegramId },
        //   { userStep: "editProfileMenu" },
        // );

        existingUser.registerStep = "editProfileMenu";
        existingUser.userStep = "editProfileMenu";
        existingUser.changePhotoStep = "";
        // await existingUser.save();
        usersMap.set(telegramId, {
          time: Date.now(),
          user: existingUser,
        });

        await reply(
          ctx,
          next,
          redisClient,
          `1. ${"مشاهده پروفایل ها"} \n2. ${"ویرایش پروفایلم"} \n3. ${"تغییر عکس من"}`,
          [[{ text: "1🚀" }, { text: "2" }, { text: "3" }]],
        );
      } catch (error) {
        console.log({ error });
      }
    } else {
      const photos = existingUser.profileImages || [];
      const fullName = existingUser.fullName;
      const age = existingUser.age;
      const state = existingUser.state;
      const bio = existingUser?.bio ?? "";

      // console.log({ photos });
      // console.log({ photos2: existingUser.profileImagesEdit });

      try {
        // const buffer = await getPic(photos[0]);
        try {
          await ctx.replyWithPhoto(
            checkUrl(photos[0]),
            // {
            //   source:
            //     fs.existsSync(photos[0]) &&
            //     fs.createReadStream(photos[0]),
            // },
            {
              caption: `${fullName}, ${age}, ${state} ${
                bio ? "\n" + bio : ""
              } `,
            },
          );
        } catch (e) {
          try {
            // await ctx.reply(
            //   `${fullName}, ${age}, ${state} ${
            //     bio ? "\n" + bio : ""
            //   } `,
            // );
            await reply(
              ctx,
              next,
              redisClient,
              `${fullName}, ${age}, ${state} ${
                bio ? "\n" + bio : ""
              } `,
            );
          } catch (error) {
            console.log(error);
          }
        }
        await reply(ctx, next, redisClient, "درسته ؟", [
          [{ text: "بله" }, { text: "ویرایش پروفایلم" }],
        ]);
      } catch (error) {
        try {
          // await ctx.reply(
          //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
          //     "r35",
          // );
          await reply(
            ctx,
            next,
            redisClient,
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)",
          );
          console.log({ error });
        } catch (e) {}
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

      await reply(
        ctx,
        next,
        redisClient,
        `1. ${"مشاهده پروفایل ها"} \n2. ${"ویرایش پروفایلم"} \n3. ${"تغییر عکس من"}`,
        [[{ text: "1🚀" }, { text: "2" }, { text: "3" }]],
      );
    } catch (error) {
      console.log({ error });
    }
  } else if (ctx.message.photo) {
    try {
      // console.log("start photoooooo");
      const photos = existingUser.profileImagesEdit || [];
      if (photos.length === 3) return;
      // await ctx.reply("⌛️");
      await reply(ctx, next, redisClient, "⌛️");

      const fileId = ctx.message.photo.at(-1).file_id;
      const fileLink = await ctx.telegram.getFileLink(fileId);

      const imageUrl = await uploadImageFromUrl(fileLink);
      // const imageUrl = fileLink?.href || "";
      // console.log({ imageUrl });
      if (photos.length === 3) return;
      photos.push(imageUrl);
      await Pictures.create({
        telegramId: +telegramId || existingUser.telegramId || 0,
        fullName: existingUser.fullName || "",
        bio: existingUser?.bio || "",
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
        if (!existingUser?.limitGetPicture) {
          existingUser.limitGetPicture = {
            time: Date.now(),
            count: 1,
          };
        } else {
          try {
            existingUser.limitGetPicture.count += 1;
          } catch (_) {}
        }
        await existingUser.save();
        usersMap.set(telegramId, {
          time: Date.now(),
          user: existingUser,
        });
        const photos = existingUser.profileImages || [];
        const fullName = existingUser.fullName;
        const age = existingUser.age;
        const state = existingUser.state;
        const bio = existingUser?.bio ?? "";

        try {
          await ctx.replyWithPhoto(checkUrl(photos[0]), {
            caption: `${fullName}, ${age}, ${state} ${
              bio ? "\n" + bio : ""
            } `,
          });
        } catch (e) {
          try {
            await reply(
              ctx,
              next,
              redisClient,
              `${fullName}, ${age}, ${state} ${
                bio ? "\n" + bio : ""
              } `,
            );
          } catch (error) {
            console.log(error);
          }
        }

        await reply(ctx, next, redisClient, "درسته ؟", [
          [{ text: "بله" }, { text: "ویرایش پروفایلم" }],
        ]);
      } catch (error) {
        try {
          console.log({ error });
          await reply(
            ctx,
            next,
            redisClient,
            "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو) lk39",
          );
        } catch (e) {}
      }
      // }, 1000);

      return;
      // }

      return;
      // }
    } catch (error) {
      try {
        // await ctx.reply(
        //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
        //     "r30",
        // );
        await reply(
          ctx,
          next,
          redisClient,
          "⭕ مشکل در آپلود تصویر\n\nمشکل به احتمال زیاد از زیرساخت بله یا سرعت اینترنت است لطفا ساعتی بعد مجددا امتحان کنید\nپشتیبانی : @abolfazl021mokhtari",
        );
        console.log({ error: error.message });
      } catch (e) {}
    }
  } else if (ctx?.message?.text === "تمام ، ذخیره تصاویر ✅") {
    // console.log("changePhoto - 4");

    try {
      // await ctx.reply("");
      await reply(ctx, next, redisClient, "⌛️");
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
      const bio = existingUser.bio ?? "";

      // console.log({ photos });
      try {
        await ctx.replyWithPhoto(
          checkUrl(photos[0]),
          // {
          //   source:
          //     fs.existsSync(photos[0]) &&
          //     fs.createReadStream(photos[0]),
          // },
          {
            caption: `${fullName}, ${age}, ${state} ${
              bio ? "\n" + bio : ""
            } `,
          },
        );
      } catch (e) {
        try {
          // await ctx.reply(
          //   `${fullName}, ${age}, ${state} ${bio ? "\n" + bio : ""} `,
          // );
          await reply(
            ctx,
            next,
            redisClient,
            `${fullName}, ${age}, ${state} ${bio ? "\n" + bio : ""} `,
          );
        } catch (error) {
          console.log(error);
        }
      }

      await reply(ctx, next, redisClient, "درسته ؟", [
        [{ text: "بله" }, { text: "ویرایش پروفایلم" }],
      ]);
    } catch (error) {
      try {
        await reply(
          ctx,
          next,
          redisClient,
          "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)",
        );
      } catch (error) {
        console.log(error);
      }
    }
    return;
  } else {
    existingUser.step = "photo";
    existingUser.changePhotoStep = "";
    // await existingUser.save();
    usersMap.set(telegramId, {
      time: Date.now(),
      user: existingUser,
    });
    try {
      // await ctx.reply("عکس خود را ارسال کنید 🖼️", {
      //   reply_markup: {
      //     keyboard: [[{ text: "بازگشت" }]],
      //     resize_keyboard: true,
      //   },
      // });
      await reply(
        ctx,
        next,
        redisClient,
        "عکس خود را ارسال کنید 🖼️",
        [[{ text: "بازگشت" }]],
      );
    } catch (error) {
      try {
        // await ctx.reply(
        //   "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو)" +
        //     "r32",
        // );
        await reply(
          ctx,
          next,
          redisClient,
          "مشکلی پیش آمده است لطفا به پشتیبانی اطلاع دهید (آیدی پشتیبانی در بیو) jyuq2",
        );
      } catch (e) {}
    }
  }
};

module.exports = {
  changePhoto,
};
