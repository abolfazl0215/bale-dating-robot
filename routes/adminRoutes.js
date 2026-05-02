const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Pictures = require("../models/Pictures");
const usersMap = require("../utils/usersMap");
const removeFromExplore = require("../components/removeFromExplore");

// Get all pictures
router.get("/pictures", async (req, res) => {
  try {
    const pictures = await Pictures.find({});
    res.status(200).send({ pictures });
  } catch (error) {
    console.error("Error fetching pictures:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Block a user
router.post("/blockUser", async (req, res) => {
  try {
    const { telegramId } = req.body;

    if (!telegramId) {
      return res
        .status(400)
        .json({ error: "telegramId is required" });
    }

    const findUser = await User.findOne({ telegramId: +telegramId });

    if (!findUser) {
      return res.status(404).json({ error: "User not found" });
    }

    findUser.ban = true;
    await findUser.save();

    // Remove from explore (Redis)
    await removeFromExplore(+telegramId, req.redisClient);

    // Update user in map
    const userInMap = usersMap.get(+telegramId);
    if (userInMap) userInMap.user.ban = true;
    usersMap.set(+telegramId, {
      user: userInMap?.user || findUser,
      time: Date.now(),
    });

    // حذف تمام عکس‌ها با یک query
    const result = await Pictures.deleteMany({
      telegramId: +telegramId,
    });

    res.status(200).json({
      message: "User blocked successfully",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error blocking user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Accept a picture (delete from pending)
router.post("/acceptPicture", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "url is required" });
    }

    await Pictures.findOneAndDelete({ url });
    res.status(200).send("ok");
  } catch (error) {
    console.error("Error accepting picture:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
