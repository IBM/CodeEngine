'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const { ContainerAuthenticator } = require('ibm-cloud-sdk-core');

const { createReceiver, cosStore, verifySignature, storedHeaders } = require('./main.js');

const VECTOR_SECRET = "It's a Secret to Everybody";
const VECTOR_PAYLOAD = 'Hello, World!';
const VECTOR_SIGNATURE = 'sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17';
const DELIVERY_ID = '72d3162e-cc78-11e3-81ab-4c9367dc0958';

test('verifySignature', async (t) => {
  const secret = VECTOR_SECRET;
  const body = Buffer.from(VECTOR_PAYLOAD);
  const hex = VECTOR_SIGNATURE.slice('sha256='.length);

  const cases = [
    ['documented vector', secret, body, VECTOR_SIGNATURE, true],
    ['wrong secret', 'other', body, VECTOR_SIGNATURE, false],
    ['modified body', secret, Buffer.from('Hello, World?'), VECTOR_SIGNATURE, false],
    ['missing prefix', secret, body, hex, false],
    ['sha1 prefix', secret, body, `sha1=${hex}`, false],
    ['not hex', secret, body, 'sha256=zzzz', false],
    ['truncated', secret, body, VECTOR_SIGNATURE.slice(0, -2), false],
    ['empty', secret, body, '', false],
  ];
  for (const [name, s, b, header, want] of cases) {
    await t.test(name, () => assert.equal(verifySignature(s, b, header), want));
  }
});

test('storedHeaders only keeps the allow list', () => {
  const got = storedHeaders({
    'X-Github-Event': 'push',
    'x-github-delivery': DELIVERY_ID,
    'Content-Type': 'application/json',
    'User-Agent': 'GitHub-Hookshot/abc',
    'X-Hub-Signature-256': VECTOR_SIGNATURE,
    Authorization: 'Bearer should-not-be-stored',
  });
  assert.deepEqual(got, {
    'X-Github-Event': ['push'],
    'X-Github-Delivery': [DELIVERY_ID],
    'Content-Type': ['application/json'],
    'User-Agent': ['GitHub-Hookshot/abc'],
  });
});

function signatureFor(secret, payload) {
  return `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
}

// newRequest builds the arguments that Code Engine passes to the function for a signed GitHub delivery.
// JSON bodies arrive Base64-encoded in __ce_body.
function newRequest(payload) {
  return {
    __ce_method: 'POST',
    __ce_path: '/',
    __ce_body: Buffer.from(payload).toString('base64'),
    __ce_headers: {
      'Content-Type': 'application/json',
      'X-GitHub-Event': 'push',
      'X-GitHub-Delivery': DELIVERY_ID,
      Authorization: 'Bearer should-not-be-stored',
      'X-Hub-Signature-256': signatureFor(VECTOR_SECRET, payload),
    },
  };
}

// setBody replaces the request body and re-signs it, so only the body itself is invalid.
function setBody(req, payload) {
  req.__ce_body = Buffer.from(payload).toString('base64');
  req.__ce_headers['X-Hub-Signature-256'] = signatureFor(VECTOR_SECRET, payload);
}

function fakeStore(err) {
  return {
    keys: [],
    bodies: [],
    async put(key, body) {
      if (err) {
        throw err;
      }
      this.keys.push(key);
      this.bodies.push(body);
    },
  };
}

test('handler stores a valid delivery', async () => {
  const store = fakeStore();
  const receive = createReceiver({
    secret: VECTOR_SECRET,
    store,
    now: () => new Date('2026-11-13T12:00:00Z'),
  });
  const payload = '{"zen":"Keep it logically awesome.","repository":{"full_name":"octo/repo"}}';

  const res = await receive(newRequest(payload));

  assert.equal(res.statusCode, 202);
  assert.deepEqual(store.keys, [`20261113T120000.000Z-${DELIVERY_ID}.json`]);

  const env = JSON.parse(store.bodies[0]);
  assert.equal(env.event, 'push');
  assert.equal(env.delivery_id, DELIVERY_ID);
  assert.equal(env.received_at, '2026-11-13T12:00:00.000Z');
  assert.deepEqual(env.payload, JSON.parse(payload));
  assert.ok(store.bodies[0].endsWith(`"payload":${payload}}`), 'payload must be stored as received');
  for (const name of Object.keys(env.headers)) {
    assert.ok(!/^(x-hub-signature-256|authorization)$/i.test(name), `header ${name} must not be stored`);
  }
});

test('handler rejects bad requests and stores nothing', async (t) => {
  const cases = [
    ['wrong signature', (req) => (req.__ce_headers['X-Hub-Signature-256'] = VECTOR_SIGNATURE), 403],
    ['missing signature', (req) => delete req.__ce_headers['X-Hub-Signature-256'], 403],
    ['missing delivery id', (req) => delete req.__ce_headers['X-GitHub-Delivery'], 400],
    ['unsafe delivery id', (req) => (req.__ce_headers['X-GitHub-Delivery'] = '../evil'), 400],
    ['missing event', (req) => delete req.__ce_headers['X-GitHub-Event'], 400],
    ['invalid JSON body', (req) => setBody(req, 'not json'), 400],
    ['payload too large', (req) => setBody(req, 'x'.repeat(100)), 413],
    ['wrong method', (req) => (req.__ce_method = 'GET'), 405],
  ];
  for (const [name, mutate, want] of cases) {
    await t.test(name, async () => {
      const store = fakeStore();
      const receive = createReceiver({ secret: VECTOR_SECRET, store, maxBytes: 64 });
      const req = newRequest('{"a":1}');
      mutate(req);

      const res = await receive(req);

      assert.equal(res.statusCode, want);
      assert.deepEqual(store.keys, []);
    });
  }
});

test('handler accepts a mixed-case JSON content type', async () => {
  const store = fakeStore();
  const receive = createReceiver({ secret: VECTOR_SECRET, store });
  const req = newRequest('{"a":1}');
  delete req.__ce_headers['Content-Type'];
  req.__ce_headers['content-type'] = 'Application/JSON; charset=utf-8';

  const res = await receive(req);

  assert.equal(res.statusCode, 202);
  assert.equal(store.keys.length, 1);
});

test('handler answers 5xx when storing fails', async () => {
  const receive = createReceiver({ secret: VECTOR_SECRET, store: fakeStore(new Error('boom')) });

  const res = await receive(newRequest('{"a":1}'));

  assert.equal(res.statusCode, 500);
});

// A local server that plays IAM (POST /identity/token) and COS (PUT /<bucket>/<key>).
function startFakeIamAndCos() {
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      if (req.method === 'POST' && req.url === '/identity/token') {
        server.tokenRequests.push(new URLSearchParams(body));
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const jwt = ['{"alg":"none"}', JSON.stringify({ exp })]
          .map((part) => Buffer.from(part).toString('base64url'))
          .join('.') + '.sig';
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ access_token: jwt, token_type: 'Bearer', expires_in: 3600, expiration: exp }));
      } else if (req.method === 'PUT') {
        server.puts.push({ url: req.url, authorization: req.headers.authorization, body });
        res.setHeader('ETag', '"abc"');
        res.end();
      } else {
        res.statusCode = 404;
        res.end();
      }
    });
  });
  server.tokenRequests = [];
  server.puts = [];
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

test('cosStore writes with the access token of the trusted profile', async () => {
  const server = await startFakeIamAndCos();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'receiver-test-'));
  const tokenFile = path.join(dir, 'token');
  fs.writeFileSync(tokenFile, 'compute-resource-token');
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const store = cosStore({
      endpoint: base,
      bucket: 'my-bucket',
      // the test token file stands in for the one that Code Engine mounts
      authenticator: new ContainerAuthenticator({
        iamProfileId: 'Profile-1234',
        crTokenFilename: tokenFile,
        url: base,
      }),
    });
    await store.put('a.json', '{"a":1}');
    await store.put('b.json', '{"b":2}');

    // one token exchange with the compute resource token and the trusted profile, reused for both writes
    assert.equal(server.tokenRequests.length, 1);
    const form = server.tokenRequests[0];
    assert.equal(form.get('grant_type'), 'urn:ibm:params:oauth:grant-type:cr-token');
    assert.equal(form.get('cr_token'), 'compute-resource-token');
    assert.equal(form.get('profile_id'), 'Profile-1234');

    assert.deepEqual(
      server.puts.map((p) => [p.url, p.body]),
      [
        ['/my-bucket/a.json', '{"a":1}'],
        ['/my-bucket/b.json', '{"b":2}'],
      ],
    );
    for (const put of server.puts) {
      assert.match(put.authorization, /^Bearer .+\..+\..+$/);
    }
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('cosStore aborts a write that does not finish in time', async () => {
  const server = await startFakeIamAndCos();
  // the COS endpoint accepts the PUT but never answers; the promise settles when the client hangs up
  let putClosed;
  const closedByClient = new Promise((resolve) => {
    putClosed = resolve;
  });
  const answerIam = server.listeners('request')[0];
  server.removeAllListeners('request');
  server.on('request', (req, res) => {
    if (req.method === 'PUT') {
      res.on('close', putClosed);
      return;
    }
    answerIam(req, res);
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'receiver-test-'));
  const tokenFile = path.join(dir, 'token');
  fs.writeFileSync(tokenFile, 'compute-resource-token');
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const store = cosStore({
      endpoint: base,
      bucket: 'my-bucket',
      timeoutMs: 300,
      authenticator: new ContainerAuthenticator({ iamProfileId: 'Profile-1234', crTokenFilename: tokenFile, url: base }),
    });
    const started = Date.now();

    await assert.rejects(store.put('a.json', '{"a":1}'));

    assert.ok(Date.now() - started < 2000, 'put must fail at the deadline');
    await closedByClient; // the request was cancelled, not left running
  } finally {
    server.closeAllConnections();
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
