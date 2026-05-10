const { Telegraf } = require("telegraf");
const bot = new Telegraf(
  // "890588018:8B58TpZfCWe5lZw3KPPgWChNgRxrUW0DIbg",
  "53189952:CAqduQyWuDiC7xHZWjNqQVFTTvwb3lBFzHI",
  {
    telegram: { apiRoot: "https://tapi.bale.ai/bot" },
  },
);
module.exports = bot;
