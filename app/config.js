module.exports = {
  PORT: 6338,
  MONGODB_URI:
    // "mongodb+srv://xchat:Abolfazl021_@botdb.omatymd.mongodb.net/?appName=botdb",
    "mongodb://root:iufWbfg4Or7YpwwI@services.irn9.chabokan.net:10949",
  AGES: Array.from({ length: 63 }, (_, i) => 18 + i),
  PROVIDER_TOKEN: "WALLET-l5dCPuAvjRjSLcEk",
  BOT_INVITE_BASE:
    global.currentPlatform == "bale"
      ? "https://ble.ir/pounesbot?start="
      : "https://t.me/pounesbot?start=",
};
