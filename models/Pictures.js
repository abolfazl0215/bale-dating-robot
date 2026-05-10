// models/Report.js
const mongoose = require("mongoose");
const picturesSchema = new mongoose.Schema({
  telegramId: { type: Number },
  url: { type: String, unique: true },
  fullName: String,
  bio: String,
  confirm: { type: Boolean, default: false },
  createdAt: { type: Number, default: Date.now() },
});

const Pictures = mongoose.model("Pictures", picturesSchema);

module.exports = Pictures;
