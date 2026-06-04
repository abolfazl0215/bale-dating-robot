// models/User.js
const mongoose = require("mongoose");
const userSchema = new mongoose.Schema({
  fullName: { type: String },
  telegramId: { type: Number, index: true },

  userName: { type: String },
  inviteCode: { type: String },
  inviteBy: { type: String },
  userStep: { type: String, default: "register" },
  registerStep: { type: String, default: "welcomeMessage" },
  editProfileStep: { type: String, default: "age" },
  changePhotoStep: { type: String, default: "" },

  firstLike: { type: Number, default: 0 },
  firstNope: { type: Number, default: 0 },

  lastAnsweredMessage: { type: Number },
  lastViewed: { type: Number },

  guest: { type: String, default: false },

  lastViewedByInviteCode: Number,

  giftLikeCount: { type: Number, default: 70 },

  unavailablePv: { type: Boolean, default: false },

  limitGetPicture: {
    time: { type: Number, default: Date.now() },
    count: { type: Number, default: 1 },
  },
  picScore: { type: Number, default: 50 },

  firstLikeTime: {
    type: Number,
    default: 1734878731629,
  },
  likeCount: { type: Number, default: 1 },

  payments: [
    {
      time: { type: Number, default: Date.now() },
      fee: { type: Number, default: 0 },
    },
  ],

  subscriptionExpireTime: { type: Number, default: Date.now() },
  createdAt: { type: Number, default: Date.now() },

  age: { type: Number },
  gender: { type: String },
  lookingFor: { type: String },
  state: { type: String },
  bio: { type: String },

  // genderFilter: { type: String, default: "all" },
  platform: { type: String, index: true, default: "bale" },
  appId: String,

  profileImages: [{ type: String }],
  profileImagesEdit: [{ type: String }],

  blockedByMe: [{ type: Number }],
  blocksMe: [{ type: Number }],

  sleep: { type: Boolean, default: false },
  ban: { type: Boolean, default: false },

  rememberingMessage: { type: Number, default: 0 },

  matches: [
    {
      telegramId: Number,
      fullName: String,
      userName: { type: String },
      profileImages: [String],
      state: String,
      age: String,
      bio: String,
      platform: String,
    },
  ],
});

const User = mongoose.model("User", userSchema);

module.exports = User;
