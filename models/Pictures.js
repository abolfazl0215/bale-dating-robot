// models/Report.js
const mongoose = require("mongoose");
const picturesSchema = new mongoose.Schema({
  telegramId: { type: Number },
  url: { type: String, index: true, unique: true },
  createdAt: { type: Number, index: true, default: Date.now() },
});

const Pictures = mongoose.model("Pictures", picturesSchema);

module.exports = Pictures;
