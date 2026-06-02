const fs = require('fs');
const path = require('path');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.eot': 'application/vnd.ms-fontobject',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const BINARY_EXTENSIONS = new Set([
  '.eot',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.mp4',
  '.png',
  '.webm',
  '.webp',
  '.woff',
  '.woff2',
  '.ttf',
]);

function sanitizePath(value) {
  return String(value || '')
    .split('?')[0]
    .split('#')[0]
    .replace(/\.\./g, '')
    .replace(/\/+/g, '/')
    .replace(/^\/+/, '');
}

function getRequestPath(args) {
  return sanitizePath(args.__ce_path || args.__ow_path || '/');
}

function getMethod(args) {
  return args.__ce_method || args.__ow_method || 'GET';
}

function getContentType(filePath) {
  return (
    MIME_TYPES[path.extname(filePath).toLowerCase()] ||
    'application/octet-stream'
  );
}

function isBinaryFile(filePath) {
  return BINARY_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function readFile(filePath) {
  try {
    const fullPath = path.join(__dirname, 'dist', filePath);

    if (!fs.existsSync(fullPath)) {
      return null;
    }

    const buffer = fs.readFileSync(fullPath);

    return {
      body: isBinaryFile(filePath)
        ? buffer.toString('base64')
        : buffer.toString('utf-8'),
      contentType: getContentType(filePath),
    };
  } catch {
    return null;
  }
}

function createResponse(statusCode, contentType, body, cacheControl) {
  return {
    statusCode,
    headers: {
      'Content-Type': contentType,
      ...(cacheControl ? { 'Cache-Control': cacheControl } : {}),
    },
    body,
  };
}

function serveFile(filePath) {
  const result = readFile(filePath);

  if (!result) {
    return null;
  }

  const cacheControl =
    filePath === 'index.html' ? 'no-cache' : 'public, max-age=31536000';

  return createResponse(200, result.contentType, result.body, cacheControl);
}

function main(args) {
  const requestPath = getRequestPath(args);
  const method = getMethod(args);

  if (method !== 'GET') {
    return createResponse(
      405,
      'text/plain; charset=utf-8',
      'Method Not Allowed',
    );
  }

  const filePath = requestPath || 'index.html';
  const directResponse = serveFile(filePath);

  if (directResponse) {
    return directResponse;
  }

  if (path.extname(requestPath)) {
    return createResponse(
      404,
      'text/plain; charset=utf-8',
      `Not found: /${requestPath}`,
    );
  }

  const indexResponse = serveFile('index.html');

  if (indexResponse) {
    return indexResponse;
  }

  return createResponse(
    404,
    'text/plain; charset=utf-8',
    `Not found: /${requestPath}`,
  );
}

module.exports = main;
module.exports.main = main;
