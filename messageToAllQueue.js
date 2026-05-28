const Queue = require("bull");
const bot = require("./utils/bot");

const messageToAllQueue = new Queue(
  "broadcast",
  "redis://:UkBjGl7nfkbJCpW2@services.irn8.chabokan.net:53254",
);

messageToAllQueue.process(async (job) => {
  const { telegramId, text } = job.data;

  try {
    // console.log({ telegramId });
    await bot.telegram.sendMessage(telegramId, text, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "شروع",
              url: "https://ble.ir/pounesbot?start",
            },
          ],
        ],
      },
    });
  } catch (err) {
    if (err.response?.error_code === 403) {
      console.log("User blocked:", telegramId);
    } else if (err.response?.error_code === 429) {
      const delay =
        (err.response.parameters?.retry_after || 1) * 1000;
      console.log("Rate-limited. Wait:", delay, "ms");
      await new Promise((r) => setTimeout(r, delay));
      throw err; // let Bull retry
    } else {
      console.log("Error:", err.response?.description || err.message);
    }
  }
});

module.exports = { messageToAllQueue };
