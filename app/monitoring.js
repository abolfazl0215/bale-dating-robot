const { monitorEventLoopDelay } = require("perf_hooks");

function startMemoryLogging(intervalMs = 30000) {
  setInterval(() => {
    const mem = process.memoryUsage();
    console.log({
      rss: Math.round(mem.rss / 1024 / 1024) + " MB",
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + " MB",
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + " MB",
      external: Math.round(mem.external / 1024 / 1024) + " MB",
      uptime: Math.round(process.uptime()) + " sec",
    });
  }, intervalMs);
}

function startEventLoopMonitoring(intervalMs = 30000) {
  const h = monitorEventLoopDelay({ resolution: 10 });
  h.enable();
  setInterval(() => {
    console.log({
      mean: Math.round(h.mean / 1e6) + " ms",
      max: Math.round(h.max / 1e6) + " ms",
      p99: Math.round(h.percentile(99) / 1e6) + " ms",
    });
    h.reset();
  }, intervalMs);
}

async function logRedisPerformance(redisClient) {
  if (!redisClient || redisClient.status !== "ready") {
    console.log("Redis client not connected or ready.");
    return;
  }

  const keyToTest = "test_key_for_ping";
  const valueToSet = "ping_test_value";

  try {
    let startTime = Date.now();
    let result = await redisClient.ping();
    console.log(
      `${new Date().toISOString()} | Redis PING (to ${redisClient.options.host}:${redisClient.options.port}): ${Date.now() - startTime}ms, Result: ${result}`,
    );

    startTime = Date.now();
    await redisClient.get(keyToTest);
    console.log(
      `${new Date().toISOString()} | Redis GET '${keyToTest}': ${Date.now() - startTime}ms`,
    );

    startTime = Date.now();
    result = await redisClient.set(keyToTest, valueToSet, "EX", 60);
    console.log(
      `${new Date().toISOString()} | Redis SET '${keyToTest}': ${Date.now() - startTime}ms, Result: ${result}`,
    );
  } catch (error) {
    console.error(
      `${new Date().toISOString()} | Redis performance check failed:`,
      error.message,
    );
  }
}

function startRedisPerformanceLogging(redisClient, intervalMs = 30000) {
  setInterval(() => logRedisPerformance(redisClient), intervalMs);
}

module.exports = {
  startMemoryLogging,
  startEventLoopMonitoring,
  startRedisPerformanceLogging,
};
