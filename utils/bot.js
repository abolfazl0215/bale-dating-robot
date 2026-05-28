const { Telegraf } = require("telegraf");
const bot = new Telegraf(
  // "53189952:CAqduQyWuDiC7xHZWjNqQVFTTvwb3lBFzHI",
  "464655215:70b-Xr7K_6BvjHKHklKe_q2qNSZ3ncI1-rU", //pounesbot
  {
    telegram: { apiRoot: "https://tapi.bale.ai/bot" },
  },
);
module.exports = bot;
