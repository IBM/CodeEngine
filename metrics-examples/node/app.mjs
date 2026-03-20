import express from "express";
import promClient from "prom-client";
import { closeDbClient, getDbClient } from "./utils/db.mjs";

// ====================================
// Configuration
// ====================================
const HTTPBIN_BASE_URL = process.env.HTTPBIN_BASE_URL || "https://httpbin.org";

// ====================================
// Initialize Prometheus metrics
// ====================================
const METRICS_NAME_PREFIX = process.env.METRICS_NAME_PREFIX || "mymetrics_";
// Create a registry to register the metrics
const register = new promClient.Registry();

// Create a custom counter metric with path label
// Note: For high-cardinality paths, consider using a Histogram instead to track
// request duration distribution, or a Gauge to track active requests.
// Histogram example: new promClient.Histogram({
//   name: `${METRICS_NAME_PREFIX}request_duration_seconds`,
//   help: "Request duration in seconds",
//   labelNames: ["method", "path", "status_code"],
//   buckets: [0.1, 0.5, 1, 2, 5]
// });
const counter = new promClient.Counter({
  name: `${METRICS_NAME_PREFIX}requests_total`,
  help: "Total number of requests",
  labelNames: ["method", "path"],
});
register.registerMetric(counter);

// Outbound HTTP call metrics
const outboundCallDuration = new promClient.Histogram({
  name: `${METRICS_NAME_PREFIX}outbound_request_duration_seconds`,
  help: "Duration of outbound HTTP requests in seconds",
  labelNames: ["target", "method", "status_code"],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});
register.registerMetric(outboundCallDuration);

const outboundCallTotal = new promClient.Counter({
  name: `${METRICS_NAME_PREFIX}outbound_requests_total`,
  help: "Total number of outbound HTTP requests",
  labelNames: ["target", "method", "status_code"],
});
register.registerMetric(outboundCallTotal);

// Database operation metrics
const dbQueryDuration = new promClient.Histogram({
  name: `${METRICS_NAME_PREFIX}db_query_duration_seconds`,
  help: "Duration of database queries in seconds",
  labelNames: ["operation", "table", "status"],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});
register.registerMetric(dbQueryDuration);

const dbQueryTotal = new promClient.Counter({
  name: `${METRICS_NAME_PREFIX}db_queries_total`,
  help: "Total number of database queries",
  labelNames: ["operation", "table", "status"],
});
register.registerMetric(dbQueryTotal);

const dbConnectionsActive = new promClient.Gauge({
  name: `${METRICS_NAME_PREFIX}db_connections_active`,
  help: "Number of active database connections",
});
register.registerMetric(dbConnectionsActive);

// Compute operation metrics
const computeDuration = new promClient.Histogram({
  name: `${METRICS_NAME_PREFIX}compute_duration_seconds`,
  help: "Duration of compute-intensive operations in seconds",
  labelNames: ["operation"],
  buckets: [0.5, 1, 2, 3, 5],
});
register.registerMetric(computeDuration);

if (process.env.METRICS_COLLECT_NODE_METRICS_ENABLED === "true") {
  promClient.collectDefaultMetrics({ register });
}

// ====================================
// Helper Functions
// ====================================

// Simulate compute-intensive operation
function simulateCompute(durationSeconds, cpuIntensity) {
  const startTime = Date.now();
  const endTime = startTime + durationSeconds * 1000;

  // CPU-intensive loop based on intensity (40-80%)
  while (Date.now() < endTime) {
    // Perform some CPU work
    const workIterations = Math.floor(cpuIntensity * 1000);
    for (let i = 0; i < workIterations; i++) {
      Math.sqrt(Math.random() * 1000000);
    }
    // Small sleep to control CPU usage
    const sleepTime = (100 - cpuIntensity) / 10;
    const sleepEnd = Date.now() + sleepTime;
    while (Date.now() < sleepEnd) {
      // Busy wait for precise timing
    }
  }
}

// Make outbound HTTP call with metrics
async function makeOutboundCall(endpoint, method = "GET") {
  const url = `${HTTPBIN_BASE_URL}${endpoint}`;
  const startTime = Date.now();

  try {
    const response = await fetch(url, { method });
    const duration = (Date.now() - startTime) / 1000;
    const statusCode = response.status.toString();

    // Record metrics
    outboundCallDuration.observe({ target: HTTPBIN_BASE_URL, method, status_code: statusCode }, duration);
    outboundCallTotal.inc({ target: HTTPBIN_BASE_URL, method, status_code: statusCode });

    return { success: true, status: response.status, duration, data: await response.text() };
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;

    // Record error metrics
    outboundCallDuration.observe({ target: HTTPBIN_BASE_URL, method, status_code: "error" }, duration);
    outboundCallTotal.inc({ target: HTTPBIN_BASE_URL, method, status_code: "error" });

    return { success: false, error: error.message, duration };
  }
}

// Instrumented DB query wrapper
async function executeDbQuery(dbClient, query, operation, table) {
  const startTime = Date.now();
  let status = "success";

  try {
    const result = await dbClient.query(query);
    const duration = (Date.now() - startTime) / 1000;

    dbQueryDuration.observe({ operation, table, status }, duration);
    dbQueryTotal.inc({ operation, table, status });

    return result;
  } catch (error) {
    status = "error";
    const duration = (Date.now() - startTime) / 1000;

    dbQueryDuration.observe({ operation, table, status }, duration);
    dbQueryTotal.inc({ operation, table, status });

    throw error;
  }
}

// ======================================
// Initialize Express app
// ======================================
const app = express();
app.use(express.json());
const router = express.Router();
app.use("/", router);

// Middleware to count requests with path
router.use((req, res, next) => {
  counter.inc({ method: req.method, path: req.path });
  next();
});

router.get("/", (req, res) => {
  res.send(`app '${process.env.CE_APP || "network-test-app"}' is ready!`);
});

router.get("/test-db", async (request, response) => {
  const dbClient = await getDbClient();
  if (!dbClient) {
    return response.status(500).send("Could not connect to postgres instance: no postgres instance configured");
  }

  try {
    // Update connection gauge
    dbConnectionsActive.inc();

    // Run a simple command to verify that we connected to the postgres instance
    console.log("List tables");
    const result = await executeDbQuery(
      dbClient,
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE';",
      "SELECT",
      "INFORMATION_SCHEMA.TABLES",
    );
    console.log(`Received the following query result: ${JSON.stringify(result)}`);
    response.status(200).send("Successfully connected to postgres instance");
  } catch (err) {
    console.error("Failed to connect to PostgreSQL instance", err);
    response.status(500).send(`Could not connect to postgres instance: '${err.message}'`);
  } finally {
    dbConnectionsActive.dec();
  }
});

// ====================================
// Outbound call endpoints
// ====================================

router.get("/outbound/delay", async (req, res) => {
  try {
    // Random delay between 0-2 seconds
    const delay = Math.random() * 2;

    // 5% error rate
    const shouldError = Math.random() < 0.05;

    if (shouldError) {
      // Simulate error by calling status/500
      const result = await makeOutboundCall("/status/500", "GET");

      // Simulate compute-intensive data handling
      const computeStart = Date.now();
      const computeDurationSec = Math.random() * 3; // 0-3 seconds
      const cpuIntensity = 40 + Math.random() * 40; // 40-80%
      simulateCompute(computeDurationSec, cpuIntensity);
      const actualComputeDuration = (Date.now() - computeStart) / 1000;
      computeDuration.observe({ operation: "data_processing" }, actualComputeDuration);

      return res.status(500).json({
        message: "Simulated error response",
        delay,
        outboundCall: result,
        computeTime: actualComputeDuration,
        cpuIntensity: `${cpuIntensity.toFixed(1)}%`,
      });
    }

    // Normal flow with delay
    const result = await makeOutboundCall(`/delay/${delay.toFixed(1)}`, "GET");

    // Simulate compute-intensive data handling
    const computeStart = Date.now();
    const computeDurationSec = Math.random() * 3; // 0-3 seconds
    const cpuIntensity = 40 + Math.random() * 40; // 40-80%
    simulateCompute(computeDurationSec, cpuIntensity);
    const actualComputeDuration = (Date.now() - computeStart) / 1000;
    computeDuration.observe({ operation: "data_processing" }, actualComputeDuration);

    res.status(200).json({
      message: "Outbound call completed",
      delay,
      outboundCall: result,
      computeTime: actualComputeDuration,
      cpuIntensity: `${cpuIntensity.toFixed(1)}%`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/outbound/status/:code", async (req, res) => {
  try {
    const statusCode = req.params.code;
    const result = await makeOutboundCall(`/status/${statusCode}`, "GET");

    // Simulate compute-intensive data handling
    const computeStart = Date.now();
    const computeDurationSec = Math.random() * 3;
    const cpuIntensity = 40 + Math.random() * 40;
    simulateCompute(computeDurationSec, cpuIntensity);
    const actualComputeDuration = (Date.now() - computeStart) / 1000;
    computeDuration.observe({ operation: "data_processing" }, actualComputeDuration);

    res.status(200).json({
      message: "Outbound call completed",
      requestedStatus: statusCode,
      outboundCall: result,
      computeTime: actualComputeDuration,
      cpuIntensity: `${cpuIntensity.toFixed(1)}%`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/outbound/get", async (req, res) => {
  try {
    const result = await makeOutboundCall("/get", "GET");

    // Simulate compute-intensive data handling
    const computeStart = Date.now();
    const computeDurationSec = Math.random() * 3;
    const cpuIntensity = 40 + Math.random() * 40;
    simulateCompute(computeDurationSec, cpuIntensity);
    const actualComputeDuration = (Date.now() - computeStart) / 1000;
    computeDuration.observe({ operation: "data_processing" }, actualComputeDuration);

    res.status(200).json({
      message: "Outbound GET call completed",
      outboundCall: result,
      computeTime: actualComputeDuration,
      cpuIntensity: `${cpuIntensity.toFixed(1)}%`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/outbound/post", async (req, res) => {
  try {
    const result = await makeOutboundCall("/post", "POST");

    // Simulate compute-intensive data handling
    const computeStart = Date.now();
    const computeDurationSec = Math.random() * 3;
    const cpuIntensity = 40 + Math.random() * 40;
    simulateCompute(computeDurationSec, cpuIntensity);
    const actualComputeDuration = (Date.now() - computeStart) / 1000;
    computeDuration.observe({ operation: "data_processing" }, actualComputeDuration);

    res.status(200).json({
      message: "Outbound POST call completed",
      outboundCall: result,
      computeTime: actualComputeDuration,
      cpuIntensity: `${cpuIntensity.toFixed(1)}%`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ======================================
// Start the http server
// ======================================
const port = process.env.PORT || 8080;
const server = app.listen(port, async () => {
  console.log(`Application server is running at http://localhost:${port}`);
  console.log(`Configured httpbin backend: ${HTTPBIN_BASE_URL}`);
});

// ======================================
// Metrics server
// ======================================
const metricsApp = express();
const metricsPort = 2112;
// Expose metrics endpoint
metricsApp.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});
// Start the metrics server
const metricsServer = metricsApp.listen(metricsPort, () => {
  console.log(`Metrics server is running at http://localhost:${metricsPort}`);
});

// ======================================
// Handle shutdown signals
// ======================================
process.on("SIGTERM", async () => {
  console.info("SIGTERM signal received.");
  await closeDbClient();

  metricsServer.close(() => {
    console.log("Metrics server closed.");
  });

  server.close(() => {
    console.log("Http server closed.");
  });
});
