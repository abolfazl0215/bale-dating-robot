
const { Telegraf } = require("telegraf");
const bot = new Telegraf(
  "890588018:8B58TpZfCWe5lZw3KPPgWChNgRxrUW0DIbg",
  {
    telegram: { apiRoot: "https://tapi.bale.ai/bot" },
  },
);
module.exports = bot;
