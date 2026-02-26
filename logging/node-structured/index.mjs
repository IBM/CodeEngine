import winston from "winston";
const { combine, json } = winston.format;

const logger = winston.createLogger({
  level: "debug",
  transports: [new winston.transports.Console()],
  format: combine(json()),
});

logger.info("1.This is a structured log message");
logger.debug("2.This is a structured log message");
logger.warn("3.This is a structured log message");
logger.error("4.This is a structured log message");

logger.debug("5. A structured log entry", {
  extra_key: "extra_value",
});

logger.info("6. some message that carries a ton of additional fields", {
  requestId: crypto.randomUUID(),
  userId: "user-123456",
  action: "test",
  metadata: {
    foo: "bar",
    timestamp: new Date().toISOString(),
  },
});

// Error logging
try {
  throw new Error("boom!");
} catch (err) {
  logger.error("7. Error occurred", err);
}

// Multi-line log sample
logger.info(`8. Multi-line log sample:
Line 1: initialization started
Line 2: loading modules
Line 3: modules loaded
Line 4: entering main loop
End of sample`);
