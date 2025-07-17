import logging
import json
import uuid
from datetime import datetime, timezone

# # Create the logger
logger = logging.getLogger("json_logger")
logger.setLevel(logging.DEBUG)

class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),  # Add UTC timestamp
            "level": record.levelname, # Log level (e.g., INFO, DEBUG, ERROR)
            "message": record.getMessage()
        }
        # Add extra fields to the log entry if they exist
        if hasattr(record, '__dict__'):
            for key, value in record.__dict__.items():
                # Skip standard LogRecord attributes and private attributes
                if (key not in ('args', 'asctime', 'created', 'exc_info', 'exc_text', 
                               'filename', 'funcName', 'id', 'levelname', 'levelno',
                               'lineno', 'module', 'msecs', 'message', 'msg', 
                               'name', 'pathname', 'process', 'processName', 
                               'relativeCreated', 'stack_info', 'thread', 'threadName', 'taskName') 
                    and not key.startswith('_')):
                    # Add the extra field to the log entry
                    log_entry[key] = value

        return json.dumps(log_entry)  # Return the log entry as a JSON string


# Create a console handler and set the custom JSON formatter
console_handler = logging.StreamHandler()
console_handler.setFormatter(JsonFormatter())
logger.addHandler(console_handler)

if __name__ == '__main__':
    # Regular messages
    logger.info("This is a structured log message")
    
    # Log a JSON objects (with 'message' key)
    logger.debug("A structured log entry", extra={"extra_key": "extra_value"})
    
    logger.info("some message that carries a ton of additional fields", extra={
        "requestId": str(uuid.uuid4()),
        "userId": "user-123456",
        "action": "test",
        "metadata": {
            "foo": "bar",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    })
    
    # Logging errors
    try: 
        1/0
    except Exception as err:
        logger.error(f"Error occurred: {err}")
    
    # Multi-line log sample
    logger.info("""📜 Multi-line log sample:
Line 1: initialization started
Line 2: loading modules
Line 3: modules loaded
Line 4: entering main loop
End of sample""")
