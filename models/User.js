// models/User.js
const mongoose = require("mongoose");
const userSchema = new mongoose.Schema({
  fullName: { type: String },
  telegramId: { type: Number, index: true, unique: true },
  email: { type: String, sparse: true, unique: true },
  sendFakeLike: { type: Number, default: 0 },
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

  giftLikeCount: { type: Number, default: 0 },

  userProfile: {
    telegramId: { type: Number },
    fullName: { type: String },
    userName: { type: String },
    age: { type: Number },
    state: { type: String },
    flag: { type: String },
    profileImages: { type: [String] },
    bio: { type: String },
    inviteCode: { type: String },
  },

  unavailablePv: { type: Boolean, default: false },

  firstLikeTime: {
    type: Number,
    index: true,
    default: 1734878731629,
  },
  likeCount: { type: Number, index: true, default: 1 },

  subscription: {
    time: { type: Number, default: Date.now() },
    numOfDays: { type: Number, default: 0 },
    expired: { type: Boolean, default: false },
  },
  payments: [
    {
      verified: { type: Boolean, default: false },
      authority: { type: String },
      status: { type: String },
      time: { type: Number, default: Date.now() },
      cardNumber: { type: String },
      fee: { type: Number },
    },
  ],
  createdAt: { type: Number, index: true, default: Date.now() },
  age: { type: Number },
  gender: { type: String, index: true },
  lookingFor: { type: String },
  state: { type: String, index: true },
  moreInformation: {
    education: { type: String },
    dietaryPreference: { type: String },
    job: { type: String },
    workout: { type: String },
    sleepingHabits: { type: String },
    pets: { type: String },
    bio: { type: String },
  },
  lastSeen: { type: Number, index: true, default: 1734878731629 },
  lastUpdate: { type: Number },
  profileImages: [{ type: String }],
  profileImagesEdit: [{ type: String }],
  blockedByMe: [{ type: String }],
  blocksMe: [{ type: String }],
  sentLikes: [{ contactId: String, time: Number }],
  receivedLikes: [
    {
      contactId: String,
      fullName: String,
      time: Number,
      profileImages: [
        { url: { type: String }, key: { type: String } },
      ],
      country: String,
      state: String,
      age: String,
      gender: String,
      education: String,
      dietaryPreference: String,
      job: String,
      workout: String,
      sleepingHabits: String,
      pets: String,
    },
  ],
  sleep: { type: Boolean, default: false },
  ban: { type: Boolean, default: false },
  notifications: [
    {
      type: { type: String },
      contactId: String,
      userName: String,
      fullName: String,
      time: Number,
      profileImages: [
        { url: { type: String }, key: { type: String } },
      ],
      state: String,
      city: String,
      age: Number,
      gender: String,
      education: String,
      dietaryPreference: String,
      job: String,
      workout: String,
      sleepingHabits: String,
      pets: String,
      bio: String,
      status: String,
      seen: { type: Boolean, default: false },
    },
  ],
  matches: [
    {
      telegramId: Number,
      fullName: String,
      profileImages: [String],
      country: String,
      state: String,
      flag: String,
      age: String,
      bio: String,
    },
  ],
});

const User = mongoose.model("User", userSchema);

module.exports = User;
