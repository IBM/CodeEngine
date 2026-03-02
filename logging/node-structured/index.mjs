import winston from "winston";
const { combine, json } = winston.format;

// This simple Code Engine job demonstrates how to write structured log lines 
// using the the external package winston. Other frameworks like bunyan, log4js, pino work similar

const logger = winston.createLogger({
  level: "debug",
  transports: [new winston.transports.Console()],
  format: combine(json()),
});

// Expect to be rendered as INFO level log message
logger.info("This is a structured log message");

// Expect to be rendered as DEBUG level log message
logger.debug("This is a structured log message");

// Expect to be rendered as WARN level log message
logger.warn("This is a structured log message");

// Expect to be rendered as ERROR level log message
logger.error("This is a structured log message");

// Expect to be rendered as DEBUG level log message. The extra key is available as a searchable, filterable field
logger.debug("A structured log entry that contains an extra key", {
  extra_key: "extra_value",
});

// Expect to be rendered as INFO level log message. The additional JSON struct is available as a searchable, filterable fields
logger.info("A structured log entry that carries a ton of additional fields", {
  requestId: "some-request-id",
  userId: "user-123456",
  action: "test",
  metadata: {
    foo: "bar",
  },
});

// Multi-line example. Expect to be rendered in a single log message
logger.info(`Multi-line log sample:
Line 1: initialization started
Line 2: loading modules
Line 3: modules loaded
Line 4: entering main loop
End of sample`);

// Error logging. The error stack trace is rendered in a single log message (see field stack)
try {
  throw new Error("boom!");
} catch (err) {
  logger.error("An error occurred", err);
}
