// require expressjs
import express from "express";
import fs from 'fs';

import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const SESSION_COOKIE = "session_token";

const requiredEnvVars = [
  "OIDC_CLIENT_ID",
  "OIDC_CLIENT_SECRET",
  "OIDC_PROVIDER_AUTHORIZATION_ENDPOINT",
  "OIDC_PROVIDER_TOKEN_ENDPOINT",
  "OIDC_PROVIDER_USERINFO_ENDPOINT",
  "OIDC_REDIRECT_URL",
  "COOKIE_SIGNING_PASSPHRASE",
];

requiredEnvVars.forEach((envVarName) => {
  if (!process.env[envVarName]) {
    console.log(`Missing '${envVarName}' environment variable`);
    process.exit(1);
  }
});

function encrypt(plaintext, key, iv) {
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let ciphertext = cipher.update(plaintext, "utf8", "base64");
  ciphertext += cipher.final("base64");
  return ciphertext;
}

function decrypt(ciphertext, key, iv) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(key, "base64"), Buffer.from(iv, "base64"));
  let plaintext = decipher.update(ciphertext, "base64", "utf8");
  plaintext += decipher.final("utf8");

  return plaintext;
}

// check whether the auth cookie is set
async function checkAuth(req, res, next) {
  console.log(`performing auth check for '${req.url}'`);

  console.log("Cookies: ", req.cookies);
  const encryptedSessionToken = req.cookies[SESSION_COOKIE];

  if (!encryptedSessionToken) {
    console.log(`session cookie '${SESSION_COOKIE}' not found`);
    return res.redirect("/auth/login");
  }

  // decrypt session token
  const sessionToken = decrypt(encryptedSessionToken, process.env.COOKIE_SIGNING_PASSPHRASE, IV);

  const opts = {
    method: "GET",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  };
  console.log(
    `Fetching user data from '${process.env.OIDC_PROVIDER_USERINFO_ENDPOINT}' with '${JSON.stringify(opts)}'...`
  );
  // exchange authorization code for access token & id_token
  const response = await fetch(process.env.OIDC_PROVIDER_USERINFO_ENDPOINT, opts);

  console.log(`response.ok: '${response.ok}', response.status: '${response.status}'`);
  if (!response.ok) {
    const errorResponse = await response.text();
    console.log(`errorResponse: '${errorResponse}'`);
    return res.redirect("/auth/failed");
  }

  const user_data = await response.json();
  console.log(`user_data: '${JSON.stringify(user_data)}'`);

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

  console.log(data);

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

  const access_token_data = await response.json();
  console.log(`access_token_data: '${JSON.stringify(access_token_data)}'`);

  // encrypt the access token
  const sessionCookieValue = encrypt(access_token_data.access_token, process.env.COOKIE_SIGNING_PASSPHRASE, IV);

  console.log("Setting session cookie.");
  res.cookie(SESSION_COOKIE, sessionCookieValue, {
    maxAge: 1000 * access_token_data.expires_in,
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
