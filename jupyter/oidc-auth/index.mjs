import express from "express";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import NodeCache from "node-cache";

const requiredEnvVars = [
  "OIDC_CLIENT_ID",
  "OIDC_CLIENT_SECRET",
  "OIDC_PROVIDER_AUTHORIZATION_ENDPOINT",
  "OIDC_PROVIDER_TOKEN_ENDPOINT",
  "OIDC_PROVIDER_USERINFO_ENDPOINT",
  "OIDC_REDIRECT_URL",
  "COOKIE_SIGNING_ENCRYPTION_KEY",
  "COOKIE_DOMAIN",
  "REDIRECT_URL",
];

requiredEnvVars.forEach((envVarName) => {
  if (!process.env[envVarName]) {
    console.log(`Missing '${envVarName}' environment variable`);
    process.exit(1);
  }
});

const SESSION_COOKIE = process.env.COOKIE_NAME || "session_token";
const ENCRYPTION_KEY = Buffer.from(process.env.COOKIE_SIGNING_ENCRYPTION_KEY, "base64");
const ENCRYPTION_IV = crypto.randomBytes(16);
const ENCRYPTION_ALGORITHM = "aes-256-cbc";

// check whether the KEY has got 32 bytes (256-bit)
if (ENCRYPTION_KEY.length != 32) {
  console.log(
    `Environment variable 'COOKIE_SIGNING_ENCRYPTION_KEY' has wrong length. Current: ${ENCRYPTION_KEY.length}. Expected: 32`
  );
  process.exit(1);
}

// initialize an in-memory cache to avoid fetching the user data on each request
const cache = new NodeCache({ stdTTL: 60 * 5, checkperiod: 120 });

// =================================================
// HELPER FUNCTIONS
// =================================================

// helper function to encrypt a string using the given encryption key and iv
function encrypt(plaintext, key, iv) {
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  let ciphertext = cipher.update(plaintext, "utf8", "base64");
  ciphertext += cipher.final("base64");
  return ciphertext;
}

// helper function to decrypt a string using the given encryption key and iv
function decrypt(ciphertext, key, iv) {
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  let plaintext = decipher.update(ciphertext, "base64", "utf8");
  plaintext += decipher.final("utf8");
  return plaintext;
}

// helper function to send JSON responses
function sendJSONResponse(response, returnCode, jsonObject) {
  response.status(returnCode);
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(jsonObject));
}

// helper function that reads allowlist
function parseAllowlist(listAsStr) {
  if (!listAsStr) {
    return [];
  }
  const strArr = listAsStr.split(",");
  strArr.forEach((element, index) => {
    strArr[index] = element.trim();
  });

  return strArr;
}

// =================================================
// AUTHN AND AUTHZ MIDDLEWARES
// =================================================

//
// Initialize authorization checks
const AUTHZ_USER_PROPERTY = process.env.AUTHZ_USER_PROPERTY;
const AUTHZ_ALLOWED_USERS_LIST = parseAllowlist(process.env.AUTHZ_ALLOWED_USERS);
const AUTHZ_GROUP_PROPERTY = process.env.AUTHZ_GROUP_PROPERTY;
const AUTHZ_ALLOWED_GROUPS_LIST = parseAllowlist(process.env.AUTHZ_ALLOWED_GROUPS);
let enforceUserAllowlist = false;
let enforceGroupAllowlist = false;
if (AUTHZ_USER_PROPERTY && AUTHZ_ALLOWED_USERS_LIST.length > 0) {
  console.log(
    `configured to perform allow list check towards the user property '${AUTHZ_USER_PROPERTY}'. ${AUTHZ_ALLOWED_USERS_LIST.length} allowed users`
  );
  enforceUserAllowlist = true;
} else if (AUTHZ_GROUP_PROPERTY && AUTHZ_ALLOWED_GROUPS_LIST.length > 0) {
  console.log(
    `configured to perform allow list check towards the groups property '${AUTHZ_GROUP_PROPERTY}'. ${AUTHZ_ALLOWED_GROUPS_LIST.length} allowed groups`
  );
  enforceGroupAllowlist = true;
}

function getCorrelationId(req, res, next) {
  req.correlationId = req.header("x-request-id") || crypto.randomBytes(8).toString("hex");
  next();
}

/**
 * Check whether the given user is authentication properly.
 *
 * If the user is authenticated pass on the request to the middleware or handler
 * If the user is NOT authenticated, not return a 401 response
 */
async function checkAuthn(req, res, next) {
  const startTime = Date.now();
  const fn = `${req.correlationId} -`;
  console.log(`${fn} performing authentication check`);

  const encryptedSessionToken = req.cookies[SESSION_COOKIE];

  // If the user does not have a session token yet, return a 401
  // It is up to the client to trigger a login procedure
  if (!encryptedSessionToken) {
    console.log(`${fn} session cookie '${SESSION_COOKIE}' not found`);
    return sendJSONResponse(res, 401, { reason: "no_auth" });
  }

  // Decrypt session token
  let sessionToken;
  try {
    sessionToken = decrypt(encryptedSessionToken, ENCRYPTION_KEY, ENCRYPTION_IV);
  } catch (err) {
    console.log(`${fn} failed to decrypt existing sessionToken - cause: '${err.name}', reason: '${err.message}'`);

    // This error indicates that the encrypted string couldn't get decrypted using the encryption key
    // maybe the cookie value has been encrypted with an old key
    // full error: 'error:1C800064:Provider routines::bad decrypt'
    if (err.message.indexOf("error:1C800064") > -1) {
      console.log(`${fn} enryption key has been changed. Deleting existing cookie`);
      res.clearCookie(SESSION_COOKIE);
      return sendJSONResponse(res, 400, { reason: "invalid_session" });
    }

    // error:1C80006B:Provider routines::wrong final block length
    if (err.message.indexOf("error:1C80006B") > -1) {
      console.log(`${fn} enryption key has been changed. Deleting existing cookie`);
      res.clearCookie(SESSION_COOKIE);
      return sendJSONResponse(res, 401, { reason: "invalid_session" });
    }

    // If the decrypt mechanism failed, return a 500
    // It is up to the client to trigger a login procedure
    return sendJSONResponse(res, 500, { reason: "decryption_failed" });
  }

  //
  // Check whether the user data have been cached
  const cachedData = cache.get(sessionToken);
  if (cachedData) {
    req.user = cachedData;
    console.log(`${fn} passed authentication check (cache hit), duration: ${Date.now() - startTime}ms`);
    return next();
  }

  //
  // Obtain user information for session token (aka acess token)
  try {
    const fetchStart = Date.now();
    const opts = {
      method: "GET",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    };

    console.log(`${fn} fetching user data from '${process.env.OIDC_PROVIDER_USERINFO_ENDPOINT}' ...`);
    const response = await fetch(process.env.OIDC_PROVIDER_USERINFO_ENDPOINT, opts);

    console.log(
      `${fn} received response from '${process.env.OIDC_PROVIDER_USERINFO_ENDPOINT}' - response.ok: '${
        response.ok
      }', response.status: '${response.status}', duration: ${Date.now() - fetchStart}ms`
    );
    if (!response.ok) {
      const errorResponse = await response.text();
      console.log(`${fn} error response: '${errorResponse}'`);
      return sendJSONResponse(res, 401, { reason: "auth_failed" });
    }

    const user_data = await response.json();
    // console.log(`${fn} user_data: '${JSON.stringify(user_data)}'`);

    // store the user data in the in-memory cache
    cache.set(sessionToken, user_data);

    // setting user into the request context
    req.user = user_data;
  } catch (err) {
    console.log(
      `${fn} failed to obtain user information from '${process.env.OIDC_PROVIDER_USERINFO_ENDPOINT}' for the given access token - cause: '${err.name}', reason: '${err.message}'`
    );
    res.clearCookie(SESSION_COOKIE);
    return sendJSONResponse(res, 401, { reason: "auth_failed" });
  }

  console.log(`${fn} passed authentication check, duration: ${Date.now() - startTime}ms`);
  next();
}

/**
 * Check whether the given user is authorized properly.
 *
 * If the user is authorized pass on the request to the middleware or handler
 * If the user is NOT authorized, not return a 403 response
 */
async function checkAuthz(req, res, next) {
  const startTime = Date.now();
  const fn = `${req.correlationId} -`;
  console.log(`${fn} performing authorization check`);

  // perform an authorization check based on a user property match
  if (enforceUserAllowlist) {
    const userValue = req.user[AUTHZ_USER_PROPERTY];
    console.log(`${fn} checking whether given user.${AUTHZ_USER_PROPERTY}='${userValue}' is allow listed`);

    if (!AUTHZ_ALLOWED_USERS_LIST.includes(userValue)) {
      console.log(
        `${fn} authz denied. user.${AUTHZ_USER_PROPERTY}='${userValue}' is NOT allow listed. User: '${JSON.stringify(
          req.user
        )}'`
      );
      return sendJSONResponse(res, 403, { reason: "forbidden" });
    }
  }

  // perform an authorization check based on a user group match
  if (enforceGroupAllowlist) {
    const userGroups = req.user[AUTHZ_GROUP_PROPERTY] || [];
    console.log(`${fn} checking whether at least one of the user.${AUTHZ_GROUP_PROPERTY} is allow listed.`);

    let authorized = false;
    Array.isArray(userGroups) &&
      userGroups.some((group) => {
        return AUTHZ_ALLOWED_GROUPS_LIST.includes(group);
      });

    if (!authorized) {
      console.log(
        `${fn} authz denied. None of the groups listed in user.${AUTHZ_GROUP_PROPERTY} is allow listed. User: '${JSON.stringify(
          req.user
        )}'`
      );
      return sendJSONResponse(res, 403, { reason: "forbidden" });
    }
  }

  console.log(`${fn} passed authorization check, duration: ${Date.now() - startTime}ms`);
  next();
}

// =================================================
// EXPRESS SETUP
// =================================================

const app = express();
app.use(express.json());
app.use(cookieParser());

// Use router to bundle all routes to /
const router = express.Router();
app.use("/", router);

// Route that initiates the login procedure by redirecting to the OIDC provider
router.get("/auth/login", (req, res) => {
  console.log(`handling /auth/login`);

  // redirect to the configured OIDC provider
  res.redirect(
    `${process.env.OIDC_PROVIDER_AUTHORIZATION_ENDPOINT}?client_id=${
      process.env.OIDC_CLIENT_ID
    }&redirect_uri=${encodeURIComponent(
      process.env.OIDC_REDIRECT_URL
    )}&response_type=code&scope=openid+profile&state=state`
  );
});

// Route that completes the login procedure by receivng a code provided by the OIDC provider.
// To verify the code, this endpoint requests an access token from the OIDC provider in exchange for the given code
router.get("/auth/callback", async (req, res) => {
  const startTime = Date.now();
  console.log(`handling /auth/callback`);

  // Exchange authorization code for access token & id_token
  let accessTokenData;
  try {
    const { code } = req.query;
    const data = {
      code,
      redirect_uri: process.env.OIDC_REDIRECT_URL,
      grant_type: "authorization_code",
    };

    console.log(`obtaining access token from '${process.env.OIDC_PROVIDER_TOKEN_ENDPOINT}' ...`);
    const response = await fetch(
      `${process.env.OIDC_PROVIDER_TOKEN_ENDPOINT}?${new URLSearchParams(data).toString()}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          Authorization:
            "Basic " +
            Buffer.from(process.env.OIDC_CLIENT_ID + ":" + process.env.OIDC_CLIENT_SECRET).toString("base64"),
        },
      }
    );

    console.log(
      `Received response from '${process.env.OIDC_PROVIDER_TOKEN_ENDPOINT}' - response.ok: '${
        response.ok
      }', response.status: '${response.status}', duration: ${Date.now() - startTime}ms`
    );
    if (!response.ok) {
      const errorResponse = await response.text();
      console.log(`errorResponse: '${errorResponse}'`);
      return res.redirect("/auth/failed");
    }

    accessTokenData = await response.json();
  } catch (err) {
    console.log(
      `Failed to obtain access token on '${process.env.OIDC_PROVIDER_TOKEN_ENDPOINT}' for the given code`,
      err
    );
    return res.redirect("/auth/failed");
  }

  // Encrypt the access token
  const sessionCookieValue = encrypt(accessTokenData.access_token, ENCRYPTION_KEY, ENCRYPTION_IV);

  const maxAge = accessTokenData.expires_in ? 1000 * accessTokenData.expires_in : 600_000; // defaults to 10min
  console.log(
    `Setting session cookie '${SESSION_COOKIE}' for domain '${process.env.COOKIE_DOMAIN}' (max age: '${maxAge}ms')`
  );
  res.cookie(SESSION_COOKIE, sessionCookieValue, {
    maxAge,
    httpOnly: true,
    path: "/",
    secure: true,
    domain: process.env.COOKIE_DOMAIN,
  });

  // Redirect to the external redirect URL
  console.log(`Redirecting to '${process.env.REDIRECT_URL}'...`);
  return res.redirect(process.env.REDIRECT_URL);
});

// Route that renders an auth failed page
router.get("/auth/failed", (req, res) => {
  console.log(`handling /auth/failed for '${req.url}'`);
  sendJSONResponse(res, 401, { status: "auth_failed" });
});

// Define a simple root route.
// This route does not enforce any authentication or authorization
router.get("/", (req, res) => {
  console.log(`handling / for '${req.url}'`);
  return sendJSONResponse(res, 200, { status: "ok" });
});

// Define the auth route that actually enforces authentication and authorization
router.get("/auth", getCorrelationId, checkAuthn, checkAuthz, (req, res) => {
  console.log(`${req.correlationId} - authn&authz checks passed!`);
  return sendJSONResponse(res, 200, { status: "ok", authenticated: true, authorized: true });
});

// Serve static files
app.use("/public", express.static("public"));

// Start server
const port = process.env.PORT || 8080;
const server = app.listen(port, () => {
  console.log(`HTTP server is up and running on port ${port}!`);
});

// Make sure the server terminates properly
process.on("SIGTERM", () => {
  console.info("SIGTERM signal received.");
  server.close(() => {
    console.log("HTTP server closed.");
  });
});
