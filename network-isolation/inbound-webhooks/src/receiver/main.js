// webhook-receiver is a Code Engine function that receives webhooks, validates their HMAC
// signature and stores every valid delivery as one JSON envelope object in a COS bucket.
//
// It is written for GitHub; the sender-specific part is marked below.
//
// It is deployed as a code bundle image (see Dockerfile.receiver) and authenticates to COS with the
// Code Engine trusted profile (compute resource token), no API key involved.
'use strict';

const crypto = require('node:crypto');

const { ContainerAuthenticator } = require('ibm-cloud-sdk-core');
const COS = require('ibm-cos-sdk');

// --- Sender-specific part: adapt this block for your webhook sender ----------

// Code Engine functions accept request bodies up to 5 MB (GitHub sends up to 25 MB). Lower it
// with MAX_BODY_BYTES if your sender sends less.
const DEFAULT_MAX_BODY_BYTES = 5 << 20;

const SIGNATURE_HEADER = 'x-hub-signature-256';
const DELIVERY_HEADER = 'x-github-delivery';
const EVENT_HEADER = 'x-github-event';

// delivery IDs are GUIDs; only accept characters that are safe in an object key
const DELIVERY_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

// verifySignature checks the X-Hub-Signature-256 header value ("sha256=<hex hmac>")
// against the HMAC-SHA256 of the raw body, using a constant-time comparison.
function verifySignature(secret, body, header) {
  if (typeof header !== 'string' || !header.startsWith('sha256=')) {
    return false;
  }
  const hexSig = header.slice('sha256='.length);
  if (!/^(?:[0-9a-fA-F]{2})+$/.test(hexSig)) {
    return false;
  }
  const got = Buffer.from(hexSig, 'hex');
  const want = crypto.createHmac('sha256', secret).update(body).digest();
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

// canonicalHeaderName turns "x-github-event" into "X-Github-Event".
function canonicalHeaderName(name) {
  return name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('-');
}

// storedHeaders returns the request headers worth keeping. It is an allow list,
// so the signature and any credentials are never stored.
function storedHeaders(headers) {
  const out = {};
  for (const [name, value] of Object.entries(headers)) {
    const lower = name.toLowerCase();
    if (lower.startsWith('x-github-') || lower === 'content-type' || lower === 'user-agent') {
      out[canonicalHeaderName(lower)] = [String(value)];
    }
  }
  return out;
}

// -----------------------------------------------------------------------------

// GitHub gives up on a delivery after 10 seconds, so fail the COS write before that.
const STORE_TIMEOUT_MS = 8000;

// requireEnv returns the value of an environment variable and throws if it is unset or empty.
function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`environment variable ${name} is required`);
  }
  return value;
}

// expiryOf returns the expiry time (ms since the epoch) of an IAM access token, which is a JWT.
function expiryOf(accessToken) {
  const claims = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8'));
  return claims.exp * 1000;
}

// cosStore writes objects to a bucket. The authenticator, a ContainerAuthenticator of the IBM Cloud SDK
// core, exchanges the compute resource token that Code Engine mounts into the function for an IAM access
// token of the trusted profile, and caches and renews it. The COS SDK asks for that token through authCallback.
// put aborts the request after timeoutMs in total (including retries), so a failed put does not
// leave a write running that could still store the object after the sender was told it failed.
function cosStore({ endpoint, bucket, authenticator, timeoutMs = STORE_TIMEOUT_MS }) {
  const cos = new COS.S3({
    endpoint,
    s3ForcePathStyle: true,
    maxRetries: 1,
    httpOptions: { connectTimeout: 3000, timeout: timeoutMs },
    authCallback: async () => {
      const request = { headers: {} };
      await authenticator.authenticate(request);
      const accessToken = request.headers.Authorization.replace(/^Bearer /, '');
      return { accessToken, expiration: expiryOf(accessToken) };
    },
  });

  return {
    async put(key, body) {
      const request = cos.putObject({ Bucket: bucket, Key: key, Body: body, ContentType: 'application/json' });
      const timer = setTimeout(() => request.abort(), timeoutMs);
      try {
        await request.promise();
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

// withTimeout fails the promise if it does not settle within ms milliseconds.
async function withTimeout(promise, ms) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// reply builds a plain text function response; headers are added to the Content-Type header.
function reply(statusCode, text, headers = {}) {
  return { statusCode, headers: { 'Content-Type': 'text/plain', ...headers }, body: `${text}\n` };
}

// bodyEncoding returns how Code Engine encodes __ce_body: Base64 for JSON, plain text otherwise.
function bodyEncoding(contentType) {
  return contentType.toLowerCase().startsWith('application/json') ? 'base64' : 'utf8';
}

// requestBody returns the raw request body. Code Engine passes it in __ce_body, encoded as bodyEncoding says.
function requestBody(args, encoding) {
  const raw = args.__ce_body;
  return typeof raw === 'string' ? Buffer.from(raw, encoding) : Buffer.alloc(0);
}

// createReceiver returns the request handler. secret is the webhook signing secret, store has an
// async put(key, body) method, now returns the current Date (injectable for tests), and maxBytes
// is the largest accepted request body.
function createReceiver({ secret, store, now = () => new Date(), maxBytes = DEFAULT_MAX_BODY_BYTES }) {
  return async function receive(args) {
    if (args.__ce_method !== 'POST') {
      return reply(405, 'method not allowed', { Allow: 'POST' });
    }

    const headers = {};
    for (const [name, value] of Object.entries(args.__ce_headers || {})) {
      headers[name.toLowerCase()] = value;
    }

    // reject unsigned requests before looking at the body
    const sig = headers[SIGNATURE_HEADER];
    if (!sig) {
      console.log(`rejected: missing ${SIGNATURE_HEADER} header`);
      return reply(403, 'missing signature');
    }

    // Reject oversized bodies before decoding them: the decoded size is known without allocating the
    // buffer, so a body that is not signed correctly does not cost memory proportional to its size.
    const encoding = bodyEncoding(String(headers['content-type'] || ''));
    if (typeof args.__ce_body === 'string' && Buffer.byteLength(args.__ce_body, encoding) > maxBytes) {
      return reply(413, 'payload too large');
    }
    const body = requestBody(args, encoding);

    // validate the signature over the raw body before looking at anything else
    if (!verifySignature(secret, body, sig)) {
      console.log('rejected: signature mismatch');
      return reply(403, 'signature mismatch');
    }

    const deliveryId = headers[DELIVERY_HEADER];
    const event = headers[EVENT_HEADER];
    if (!DELIVERY_ID_PATTERN.test(deliveryId || '') || !event) {
      console.log(`rejected: missing or invalid ${DELIVERY_HEADER} / ${EVENT_HEADER}`);
      return reply(400, 'missing or invalid delivery headers');
    }
    const payload = body.toString('utf8');
    try {
      JSON.parse(payload);
    } catch {
      console.log(`rejected: delivery ${deliveryId} has no valid JSON body (content type must be application/json)`);
      return reply(400, 'body must be JSON');
    }

    const received = now();
    // the payload is embedded as it was received, so the signed bytes stay intact
    const envelope =
      '{' +
      `"received_at":${JSON.stringify(received.toISOString())},` +
      `"delivery_id":${JSON.stringify(deliveryId)},` +
      `"event":${JSON.stringify(event)},` +
      `"headers":${JSON.stringify(storedHeaders(args.__ce_headers || {}))},` +
      `"payload":${payload}` +
      '}';

    const key = `${received.toISOString().replace(/[-:]/g, '')}-${deliveryId}.json`;
    try {
      await withTimeout(store.put(key, envelope), STORE_TIMEOUT_MS);
    } catch (err) {
      // 5xx so that the failed delivery is visible in the sender and can be redelivered
      console.log(`delivery ${deliveryId}: storing ${key} failed: ${err.message}`);
      return reply(500, 'storing delivery failed');
    }

    console.log(`stored delivery ${deliveryId} (event ${event}) as ${key}`);
    return reply(202, 'accepted');
  };
}

let receiver;

// main is the entry point of the Code Engine function. The receiver is created on the first request,
// so the environment is only read once per function instance.
async function main(args) {
  if (!receiver) {
    const maxBytes = Number(process.env.MAX_BODY_BYTES || DEFAULT_MAX_BODY_BYTES);
    if (!Number.isInteger(maxBytes) || maxBytes <= 0) {
      throw new Error('MAX_BODY_BYTES must be a positive integer');
    }
    receiver = createReceiver({
      secret: requireEnv('WEBHOOK_SECRET'),
      maxBytes,
      store: cosStore({
        endpoint: requireEnv('COS_ENDPOINT'),
        bucket: requireEnv('COS_BUCKET'),
        authenticator: new ContainerAuthenticator({
          iamProfileId: requireEnv('TRUSTED_PROFILE_ID'),
          url: process.env.IBM_AUTH_ENDPOINT || 'https://private.iam.cloud.ibm.com',
        }),
      }),
    });
    console.log(`writing to bucket ${process.env.COS_BUCKET}`);
  }
  return receiver(args);
}

module.exports = { main, createReceiver, cosStore, verifySignature, storedHeaders };
