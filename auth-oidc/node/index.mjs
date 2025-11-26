import express from "express";
import crypto from "crypto";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const requiredEnvVars = [
  "OIDC_CLIENT_ID",
  "OIDC_CLIENT_SECRET",
  "OIDC_PROVIDER_AUTHORIZATION_ENDPOINT",
  "OIDC_PROVIDER_TOKEN_ENDPOINT",
  "OIDC_PROVIDER_USERINFO_ENDPOINT",
  "OIDC_REDIRECT_URL",
  "COOKIE_ENCRYPTION_KEY",
];

let missingEnvVars = [];
requiredEnvVars.forEach((envVarName) => {
  if (!process.env[envVarName]) {
    console.log(`Missing '${envVarName}' environment variable`);
    missingEnvVars.push(envVarName);
  }
});

if (missingEnvVars.length > 0) {
  console.log(`Aborting due to missing env vars '${JSON.stringify(missingEnvVars)}'`);
}

const SESSION_COOKIE = process.env.COOKIE_NAME || "session_token";
const ENCRYPTION_KEY = Buffer.from(process.env.COOKIE_ENCRYPTION_KEY, "base64");
let ENCRYPTION_IV = crypto.randomBytes(16);
if (process.env.COOKIE_ENCRYPTION_IV) {
  ENCRYPTION_IV = Buffer.from(process.env.COOKIE_ENCRYPTION_IV, "base64");
}
const ENCRYPTION_ALGORITHM = "aes-256-cbc";

// check whether the KEY has got 32 bytes (256-bit)
if (process.env.COOKIE_ENCRYPTION_KEY && ENCRYPTION_KEY.length != 32) {
  console.log(
    `Environment variable 'COOKIE_ENCRYPTION_KEY' has wrong length. Current: ${ENCRYPTION_KEY.length}. Expected: 32`
  );
  process.exit(1);
}

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

// check whether the auth cookie is set
async function checkAuth(req, res, next) {
  console.log(`performing auth check for '${req.url}'`);

  if (missingEnvVars.length > 0) {
    console.log(`redirecting request to auth failed page'`);
    return res.redirect("/auth/failed");
  }

  console.log("Cookies: ", req.cookies);
  const encryptedSessionToken = req.cookies[SESSION_COOKIE];

  if (!encryptedSessionToken) {
    console.log(`session cookie '${SESSION_COOKIE}' not found`);
    return res.redirect("/auth/login");
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
    if (err.message.includes("error:1C800064")) {
      console.log(`${fn} enryption key has been changed. Deleting existing cookie`);
      res.clearCookie(SESSION_COOKIE);
      return sendJSONResponse(res, 400, { reason: "invalid_session" });
    }

    // error:1C80006B:Provider routines::wrong final block length
    if (err.message.includes("error:1C80006B")) {
      console.log(`${fn} enryption key has been changed. Deleting existing cookie`);
      res.clearCookie(SESSION_COOKIE);
      return res.status(401).redirect("/auth/failed?code=invalid_session");
    }

    // If the decrypt mechanism failed, return a 500
    // It is up to the client to trigger a login procedure
    return res.status(500).redirect("/auth/failed?code=decryption_failed");
  }

  const opts = {
    method: "GET",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  };

  // exchange authorization code for access token & id_token
  const response = await fetch(process.env.OIDC_PROVIDER_USERINFO_ENDPOINT, opts);

  console.log(
    `fetched user data from '${process.env.OIDC_PROVIDER_USERINFO_ENDPOINT}' response.ok: '${response.ok}', response.status: '${response.status}'`
  );
  if (!response.ok) {
    const errorResponse = await response.text();
    console.log(`errorResponse: '${errorResponse}'`);
    return res.redirect("/auth/failed");
  }

  const user_data = await response.json();
  // console.log(`user_data: '${JSON.stringify(user_data)}'`);

  // setting user into the request context
  req.user = user_data;

  next();
}

const app = express();
app.use(express.json());
app.use(cookieParser());

// Define a view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// use router to bundle all routes to /
const router = express.Router();

app.use("/", router);

router.get("/auth/callback", async (req, res) => {
  console.log(`handling /auth/callback`);

  const { code } = req.query;
  const data = {
    code,
    redirect_uri: process.env.OIDC_REDIRECT_URL,
    grant_type: "authorization_code",
  };

  // exchange authorization code for access token & id_token
  const response = await fetch(`${process.env.OIDC_PROVIDER_TOKEN_ENDPOINT}?${new URLSearchParams(data).toString()}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization:
        "Basic " + Buffer.from(process.env.OIDC_CLIENT_ID + ":" + process.env.OIDC_CLIENT_SECRET).toString("base64"),
    },
  });

  console.log(`response.ok: '${response.ok}', response.status: '${response.status}'`);
  if (!response.ok) {
    const errorResponse = await response.text();
    console.log(`errorResponse: '${errorResponse}'`);
    return res.redirect("/auth/failed");
  }

  const accessTokenData = await response.json();

  // encrypt the access token
  const sessionCookieValue = encrypt(accessTokenData.access_token, ENCRYPTION_KEY, ENCRYPTION_IV);
  const maxAge = accessTokenData.expires_in ? 1000 * accessTokenData.expires_in : 600_000; // defaults to 10min
  console.log(`Setting session cookie '${SESSION_COOKIE}' (max age: '${maxAge}ms')`);

  res.cookie(SESSION_COOKIE, sessionCookieValue, {
    maxAge,
    httpOnly: true,
    path: "/",
    secure: true,
  });

  // redirect to the home route
  return res.redirect("/");
});

router.get("/auth/login", (req, res) => {
  console.log(`handling /auth/login for '${req.url}'`);
  console.log(`baseUrl: '${req.baseUrl}'`);

  // redirect to the configured OIDC provider
  res.redirect(
    `${process.env.OIDC_PROVIDER_AUTHORIZATION_ENDPOINT}?client_id=${
      process.env.OIDC_CLIENT_ID
    }&redirect_uri=${encodeURIComponent(
      process.env.OIDC_REDIRECT_URL
    )}&response_type=code&scope=openid+profile&state=state`
  );
});

const viewParams = {
  pageTitle: "OIDC sample - IBM Cloud Code Engine",
  clientId: process.env.OIDC_CLIENT_ID,
  providerAuthorizationEndpoint: process.env.OIDC_PROVIDER_AUTHORIZATION_ENDPOINT,
  providerTokenEndpoint: process.env.OIDC_PROVIDER_TOKEN_ENDPOINT,
  providerUserInfoEndpoint: process.env.OIDC_PROVIDER_USERINFO_ENDPOINT,
};

// route that renders an auth failed page
router.get("/auth/failed", (req, res) => {
  console.log(`handling /auth/failed for '${req.url}'`);
  res.status(401);
  res.render("authfailed", viewParams);
});

// get on root route
router.get("/", checkAuth, (req, res) => {
  console.log(`handling / for '${req.url}'`);
  res.render("index", {
    ...viewParams,
    user: { token: req.cookies[SESSION_COOKIE], profile: JSON.stringify(req.user) },
  });
});

// serve static files
app.use("/public", express.static("public"));

// start server
const port = process.env.PORT || 8080;
const server = app.listen(port, () => {
  console.log(`Server is up and running on port ${port}!`);
});

process.on("SIGTERM", () => {
  console.info("SIGTERM signal received.");
  server.close(() => {
    console.log("Http server closed.");
  });
});
