#!/bin/bash
set -e

echo "[build-spa] Starting SPA build process"

# Find frontend folder (exclude node_modules, dist, hidden dirs)
echo "[build-spa] Finding frontend folder..."
FRONTEND_DIR=$(find . -maxdepth 1 -type d ! -name "." ! -name ".." ! -name "node_modules" ! -name "dist" ! -name ".*" | head -n 1)

if [ -z "$FRONTEND_DIR" ]; then
    echo "[build-spa] ERROR: No frontend folder found"
    exit 1
fi

FRONTEND_DIR=$(basename "$FRONTEND_DIR")
echo "[build-spa] Found frontend folder: $FRONTEND_DIR"

# Install dependencies
echo "[build-spa] Installing dependencies in $FRONTEND_DIR..."
cd "$FRONTEND_DIR"
npm ci --production=false 2>/dev/null || npm install

# Build
echo "[build-spa] Building SPA..."
npm run build

# Find the output directory (dist or build)
echo "[build-spa] Locating build output directory..."
if [ -d "dist" ]; then
    OUTPUT_DIR="dist"
elif [ -d "build" ]; then
    OUTPUT_DIR="build"
else
    echo "[build-spa] ERROR: No dist/ or build/ directory found after npm run build"
    exit 1
fi

echo "[build-spa] Output directory found: $OUTPUT_DIR"

# Find index.html within the output directory to locate the actual build artifacts
echo "[build-spa] Searching for index.html in $OUTPUT_DIR..."
INDEX_PATH=$(find "$OUTPUT_DIR" -name "index.html" -type f 2>/dev/null | head -n 1)

if [ -z "$INDEX_PATH" ]; then
    echo "[build-spa] ERROR: No index.html found in $OUTPUT_DIR"
    exit 1
fi

# Get the directory containing index.html (this is where the build artifacts are)
BUILD_ARTIFACTS_DIR=$(dirname "$INDEX_PATH")
echo "[build-spa] Build artifacts found in: $BUILD_ARTIFACTS_DIR"

# List files at the same level as index.html for verification
echo "[build-spa] Files at build artifacts level:"
ls -lh "$BUILD_ARTIFACTS_DIR"

# Get absolute path of build artifacts directory
cd "$BUILD_ARTIFACTS_DIR"
ABSOLUTE_BUILD_DIR=$(pwd)
echo "[build-spa] Copying from: $ABSOLUTE_BUILD_DIR"

# Go back to root (frontend directory)
cd - > /dev/null
cd ..

# Create root dist directory and copy build artifacts
echo "[build-spa] Copying build artifacts to root dist/..."
mkdir -p dist
cp -r "$ABSOLUTE_BUILD_DIR/"* dist/

# Clean up
echo "[build-spa] Cleaning up source folder..."
rm -rf "$FRONTEND_DIR"

echo "[build-spa] Build complete. Final structure: main.js, package.json, dist/"

