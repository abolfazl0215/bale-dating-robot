const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const psBody = fs.readFileSync(
  path.join(root, "bot/_processStatement.body.js"),
  "utf8",
);
const processStatementModule = `"use strict";

const { registerInBot } = require("../components/registerInBot.js");
const editProfileInBot = require("../components/editProfileInBot.js");
const { changePhoto } = require("../components/changePhoto.js");
const User = require("../models/User");
const chunkArray = require("../utils/chunkArray");
const editProfileMenu = require("../components/userSteps/editProfileMenu.js");
const searchStep = require("../components/userSteps/searchStep.js");
const menuStep = require("../components/userSteps/menuStep.js");
const { reply } = require("../telegram_methods/reply.js");
const { replyBot } = require("../telegram_methods/replyBot.js");
const { generateInviteCode } = require("../utils/generateInviteCode");
const { AGES, BOT_INVITE_BASE } = require("../app/config");
const state = require("../app/state");
const dailyReport = require("../app/dailyReport");
const protobuf = require("../app/protobuf");
const session = require("../app/session");
const {
  redisClient,
  globalOperationsQueue,
  activeUsersQueue,
  newLikeQueue,
  requestToFillSuggestQueue,
} = require("../config/redis");

function createProcessStatement() {
  const {
    usersMap,
    forYouList,
    forYouTime,
    blockedUsers,
    lastViewed,
    lastTimeAddProfileToList,
  } = state;
  const { temporaryDailyReport } = dailyReport;
  const { getNowTime } = session;
  const { loadNewLikeProto, loadActiveUsersProto, NewLikeProto, ActiveUsersProto } =
    protobuf;

  const ages = AGES;

  const generateInviteLink = (telegramId) =>
    \`\${BOT_INVITE_BASE}\${generateInviteCode(telegramId)}\`;

${psBody
  .replace(/^const processStatement = /, "  const processStatement = ")
  .replace(/(?<!:)\bglobalUsers\b/g, "state.globalUsers")}

  return processStatement;
}

module.exports = { createProcessStatement };
`;

fs.writeFileSync(
  path.join(root, "bot/processStatement.js"),
  processStatementModule,
);
console.log("Built bot/processStatement.js");
