// models/DailyReport.js
const mongoose = require("mongoose");
const dailyReportSchema = new mongoose.Schema({
  time: { type: Date },
  users: [Number],
  totalOfStatements: Number,
  totalOfLikes: Number,
  totalOfMatches: Number,
});

const DailyReport = mongoose.model("DailyReport", dailyReportSchema);

module.exports = DailyReport;
