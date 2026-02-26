
// Write example unstructured logs
console.log("This is a unstructured log message without a severity identifier");
console.log("This is a unstructured log message with a severity identifier WARN \n");
console.warn("This is a unstructured log message using a specific level");
console.log("ERROR This is a unstructured log message prefixed with the level");
console.log(`${new Date().toISOString()} This is a unstructured log message prefixed with the timestamp`);
console.log(`${new Date().toISOString()} DEBUG This is a unstructured log message prefixed with the timestamp and level`);

// Multi-line example
console.log("Multi-line log sample...\\nStep 1: Validating input...\\nStep 2: Processing payment...");

// Error logging
try {
  throw new Error("boom!");
} catch (err) {
  console.error("Stacktrace example", err);
}
