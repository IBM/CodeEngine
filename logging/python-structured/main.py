
from loguru import logger
import sys
import json
import traceback

# This simple Code Engine job demonstrates how to write structured log lines 
# using the logging library loguru (https://github.com/Delgan/loguru)

# Define a custom JSON sink
def json_sink(message):
    record = message.record

    # Base fields: level + message, no timestamp
    payload = {
        "level": record["level"].name,   # e.g., "INFO"
        "message": record["message"],    # rendered message
    }

    # Merge in any bound extra fields as top-level keys
    # (skip reserved keys to avoid accidental overwrite)
    for k, v in record["extra"].items():
        if k not in ("level", "message", "stack"):
            payload[k] = v

    # If an exception is attached, render full stack trace into "stack"
    exc = record["exception"]
    if exc:
        # exc.type, exc.value, exc.traceback are available from Loguru
        stack_text = "".join(traceback.format_exception(exc.type, exc.value, exc.traceback))
        payload["stack"] = stack_text

    # Emit a single JSON line
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


# Remove default handler (which includes timestamp, etc.) and add our custom sink
logger.remove()
logger.add(json_sink, level="DEBUG")  # lowest level you want to capture


if __name__ == '__main__':
    
    # expect to be rendered as INFO level log message
    logger.info("This is a structured log message");

    # expect to be rendered as DEBUG level log message
    logger.debug("This is a structured log message");

    # expect to be rendered as WARN level log message
    logger.warning("This is a structured log message");

    # expect to be rendered as ERROR level log message
    logger.error("This is a structured log message");

    # Expect to be rendered as DEBUG level log message. The extra key is available as a searchable, filterable field
    logger.bind(extra_key="extra_value").debug("A structured log entry that contains an extra key")
    
    # Expect to be rendered as INFO level log message. The additional JSON struct is available as a searchable, filterable fields
    logger.bind(
        requestId="some-request-id",
        userId="user-123456",
        action="test",
        metadata={"foo": "bar"},
    ).info("A structured log entry that carries a ton of additional fields")

    
    # Multi-line example. Expect to be rendered in a single log message
    logger.info(
        "Multi-line log sample:\n"
        "Line 1: initialization started\n"
        "Line 2: loading modules\n"
        "Line 3: modules loaded\n"
        "Line 4: entering main loop\n"
        "End of sample"
    )
    
    # Error logging. The error stack trace is rendered in a single log message (see field stack)
    try:
        raise RuntimeError("boom!")
    except Exception:
        # logger.exception() automatically attaches the current exception info
        logger.exception("An error occurred")


    
