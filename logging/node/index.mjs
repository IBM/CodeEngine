import winston from "winston";
const { combine, timestamp, json } = winston.format;

function getCodeEngineLogger(componentName) {
  const ceTransport = new winston.transports.Console({
    level: "debug",
    format: combine(timestamp(), json()),
  });

  winston.loggers.add(componentName, {
    transports: [ceTransport],
  });

  return winston.loggers.get(componentName);
}

const logger = getCodeEngineLogger("your-logger").child({ correlationId: process.env.CE_JOBRUN });

logger.info("This is a structured log message");
logger.debug("This is a structured log message");
logger.warn("This is a structured log message");
logger.error("This is a structured log message");

logger.debug("A structured log entry", {
  extra_key: "extra_value",
});

logger.info("some message that carries a ton of additional fields", {
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
  logger.error("Error occurred", err);
}

// Multi-line log sample
logger.info(`📜 Multi-line log sample:
Line 1: initialization started
Line 2: loading modules
Line 3: modules loaded
Line 4: entering main loop
End of sample`);
