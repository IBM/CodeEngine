# This simple Code Engine job demonstrates how to write unstructured log lines 
# using the built-in capabilities of Python

# Expect to be rendered as INFO level log message
print("This is a unstructured log message without a severity identifier"); 

# Expect to be rendered as WARN level log message
print("This is a unstructured log message with a severity identifier WARN"); 

# Expect to be rendered as ERROR level log message, without the keyword ERROR being part of the message
print("ERROR This is a unstructured log message prefixed with the level"); 

# Expect to be rendered as INFO level log message, without the timestamp being part of the message
from datetime import datetime, timezone
ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
print(f"{ts} This is an unstructured log message prefixed with the timestamp")

# Expect to be rendered as DEBUG level log message, without the timestamp and keyword DEBUG being part of the message
print(f"{datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")} DEBUG This is a unstructured log message prefixed with the timestamp and level")

# Multi-line example. Expect to be rendered in a single log message
print("Multi-line log sample...\\nStep 1: Validating input...\\nStep 2: Processing payment...")

# Error logging. Expect that the stacktrace is rendered in multiple log statements 
# Note: Use structure logs to support multi-line error stack traces
try:
    raise Exception("boom!")
except Exception as err:
    print("Stacktrace example", err)
    import traceback
    print(traceback.format_exc(), end="")
