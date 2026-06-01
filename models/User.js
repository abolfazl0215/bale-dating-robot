// models/User.js
const mongoose = require("mongoose");
const userSchema = new mongoose.Schema({
  fullName: { type: String },
  telegramId: { type: Number, index: true, unique: true },

  userName: { type: String },
  inviteCode: { type: String, index: true },
  inviteBy: { type: String },
  userStep: { type: String, default: "register" },
  registerStep: { type: String, default: "welcomeMessage" },
  editProfileStep: { type: String, default: "age" },
  changePhotoStep: { type: String, default: "" },

  firstLike: { type: Number, default: 0 },
  firstNope: { type: Number, default: 0 },

  lastAnsweredMessage: { type: Number },
  lastViewed: { type: Number },

  lastViewedByInviteCode: Number,

  giftLikeCount: { type: Number, default: 70 },

  unavailablePv: { type: Boolean, default: false },

  limitGetPicture: {
    time: { type: Number, default: Date.now() },
    count: { type: Number, default: 1 },
  },

  firstLikeTime: {
    type: Number,
    index: true,
    default: 1734878731629,
  },
  likeCount: { type: Number, index: true, default: 1 },

  payments: [
    {
      time: { type: Number, default: Date.now() },
      fee: { type: Number, default: 0 },
    },
  ],

  subscriptionExpireTime: { type: Number, default: Date.now() },
  createdAt: { type: Number, index: true, default: Date.now() },

  age: { type: Number },
  gender: { type: String, index: true },
  lookingFor: { type: String },
  state: { type: String, index: true },
  bio: { type: String },

  // genderFilter: { type: String, default: "all" },
  platform: { type: String, default: "" },
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
      platform:String,
    },
  ],
});

const User = mongoose.model("User", userSchema);

module.exports = User;
