const usersMap = require("../utils/usersMap");
const forYouList = require("../utils/forYouList");
const blockedUsers = require("../utils/blockedUsers");
const lastViewed = require("../utils/lastViewed");

const lastTimeAddProfileToList = new Map();
const forYouTime = new Map();
let globalUsers = [];

module.exports = {
  usersMap,
  forYouList,
  blockedUsers,
  lastViewed,
  lastTimeAddProfileToList,
  forYouTime,
  get globalUsers() {
    return globalUsers;
  },
  setGlobalUsers(users) {
    globalUsers = users;
  },
};
