// This simple Code Engine job demonstrates how to write unstructured log lines 
// using the built-in capabilities of Node.js

// Expect to be rendered as INFO level log message
console.log("This is a unstructured log message without a severity identifier"); 

// Expect to be rendered as WARN level log message
console.log("This is a unstructured log message with a severity identifier WARN"); 

// Expect to be rendered as INFO level log message
console.warn("This is a unstructured log message using a specific level"); 

// Expect to be rendered as ERROR level log message, without the keyword ERROR being part of the message
console.log("ERROR This is a unstructured log message prefixed with the level"); 

// Expect to be rendered as INFO level log message, without the timestamp being part of the message
console.log(`${new Date().toISOString()} This is a unstructured log message prefixed with the timestamp`);

// Expect to be rendered as DEBUG level log message, without the timestamp and keyword DEBUG being part of the message
console.log(`${new Date().toISOString()} DEBUG This is a unstructured log message prefixed with the timestamp and level`);

// Multi-line example. Expect to be rendered in a single log message
console.log("Multi-line log sample...\\nStep 1: Validating input...\\nStep 2: Processing payment...");

// Error logging. Expect that the stacktrace is rendered in multiple log statements
// Note: Use structure logs to support multi-line error stack traces
try {
  throw new Error("boom!");
} catch (err) {
  console.error("Stacktrace example", err);
}
