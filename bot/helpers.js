const {
  MENU_TEXT,
  MENU_KEYBOARD,
  USERNAME_REQUIRED_TEXT,
  USERNAME_REQUIRED_INLINE,
  USERNAME_PHOTO_URL,
} = require("./constants");
const { generateInviteCode } = require("../utils/generateInviteCode");
const { reply } = require("../telegram_methods/reply");
const { checkUrl } = require("../utils/checkUrl");

/** @returns {Promise<object|undefined>} */
async function resolveExistingUser(telegramId, usersMap, User, getNowTime) {
  const cached = usersMap.get(telegramId);
  if (cached) {
    cached.time = getNowTime();
    return cached.user;
  }
  try {
    const existingUser = await User.findOne({ telegramId });
    if (existingUser) {
      usersMap.set(telegramId, { user: existingUser, time: getNowTime() });
    }
    return existingUser;
  } catch (error) {
    console.log(error);
    return undefined;
  }
}

function syncUsersMap(telegramId, user, usersMap, time = Date.now()) {
  usersMap.set(telegramId, { user, time });
}

async function replyMenu(ctx, next, redisClient) {
  await reply(ctx, next, redisClient, MENU_TEXT, MENU_KEYBOARD);
}

async function requireUsernameOrPrompt(ctx, next, redisClient, userName) {
  if (userName) return true;
  try {
    try {
      await ctx.replyWithPhoto(USERNAME_PHOTO_URL, {
        caption: USERNAME_REQUIRED_TEXT,
        reply_markup: { inline_keyboard: USERNAME_REQUIRED_INLINE },
      });
    } catch (error) {
      await reply(
        ctx,
        next,
        redisClient,
        USERNAME_REQUIRED_TEXT,
        [],
        USERNAME_REQUIRED_INLINE,
      );
    }
  } catch (e) {
    try {
      await reply(ctx, next, redisClient, USERNAME_REQUIRED_TEXT);
    } catch (error) {
      console.log(error);
    }
  }
  return false;
}

function buildProfileCaption(user, inviteCodeField = "inviteCode") {
  const { fullName, age, state, bio } = user;
  const inviteCode = user[inviteCodeField];
  return `${fullName}, ${age}, ${state}${bio ? "\n" + bio : ""} \n/user_${inviteCode || "not_found"}`;
}

function buildLikerCaption(liker) {
  const { fullName, age, state, bio, inviteCode, message: textMessage } = liker;
  const msgPart = textMessage
    ? `\n\nپیام کاربر به شما 💌 : ${textMessage}`
    : "";
  return `${fullName}, ${age}, ${state}${bio ? "\n" + bio : ""}${msgPart} \n/user_${inviteCode || "not_found"}`;
}

/**
 * Shows next profile from forYouList after shift (caller handles shift/queue).
 */
async function showForYouProfile(ctx, next, redisClient, telegramId, forYouList) {
  const nextUser = forYouList.get(telegramId)?.[0];
  if (!nextUser) {
    await reply(ctx, next, redisClient, "کاربری برای نمایش وجود ندارد");
    return null;
  }
  const { profileImages } = nextUser;
  const caption = buildProfileCaption(nextUser);
  try {
    await ctx.replyWithPhoto(checkUrl(profileImages[0]), { caption });
  } catch (error) {
    try {
      await reply(ctx, next, redisClient, caption);
    } catch (err) {
      console.log(err);
    }
  }
  return nextUser;
}

function recordLastViewed(telegramId, forYouList, lastViewed) {
  try {
    const item = forYouList.get(telegramId)?.[0]?.telegramId;
    if (!item) return;
    const current = lastViewed.get(telegramId)?.usersList ?? [];
    lastViewed.set(telegramId, {
      usersList: [...current, Number(item)],
    });
  } catch (error) {
    console.log(error);
  }
}

function buildInviteShareText(telegramId, botInviteBase) {
  const inviteLink = `${botInviteBase}${generateInviteCode(+telegramId)}`;
  return `${require("./constants").INVITE_SHARE_PREFIX}\n👉🏻 ${inviteLink}`;
}

function formatLikeLimitRemind(remindTimeMs) {
  const totalMilliseconds = Math.max(0, remindTimeMs);
  const hours = Math.floor(totalMilliseconds / (1000 * 60 * 60));
  const minutes = Math.floor(
    (totalMilliseconds % (1000 * 60 * 60)) / (1000 * 60),
  );
  return `${hours} ساعت و ${minutes} دقیقه`;
}

module.exports = {
  resolveExistingUser,
  syncUsersMap,
  replyMenu,
  requireUsernameOrPrompt,
  buildProfileCaption,
  buildLikerCaption,
  showForYouProfile,
  recordLastViewed,
  buildInviteShareText,
  formatLikeLimitRemind,
};
