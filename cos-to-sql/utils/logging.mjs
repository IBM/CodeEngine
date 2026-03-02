import winston from "winston";
const { combine, timestamp, json } = winston.format;

export function getCodeEngineLogger(componentName) {
  if (!winston.loggers.get(componentName)) {
    const ceTransport = new winston.transports.Console({
      level: "debug",
      format: combine(timestamp(), json()),
      defaultMeta: { logger: componentName },
    });

    winston.loggers.add(componentName, {
      transports: [ceTransport],
    });
  }
  return winston.loggers.get(componentName);
}
