const http = require("http");
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const { redisClient } = require("../config/redis");
const adminRoutes = require("../routes/adminRoutes");
const fakeUsersRouter = require("../routes/fakeUersRouter");
const { PORT, MONGODB_URI } = require("./config");
const { cleanupOldUsersFromMapAndSaveToDB } = require("./session");

function createApp() {
  const app = express();

  mongoose
    .connect(MONGODB_URI)
    .then(() => console.log("Connected to MongoDB"))
    .catch((err) => console.error("Could not connect to MongoDB", err));

  app.use(bodyParser.json({ limit: "10mb" }));
  app.use(
    cors({
      origin: "*",
      methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
      credentials: true,
    }),
  );
  app.use((req, res, next) => {
    req.redisClient = redisClient;
    next();
  });
  app.use(express.static("public"));

  app.use("/", adminRoutes);
  app.use("/", fakeUsersRouter);

  app.get("/", (req, res) => res.send("hi"));

  app.post("/cleanup", async (req, res) => {
    try {
      await cleanupOldUsersFromMapAndSaveToDB(0);
    } catch (error) {}
    res.send("finish ✅");
  });

  return app;
}

function startHttpServer(app) {
  const server = http.createServer(app, {});
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`server is running on port ${PORT}`);
  });
  return server;
}

module.exports = { createApp, startHttpServer };
