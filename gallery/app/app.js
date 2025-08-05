"use strict";

const { createServer } = require("http");
const { existsSync } = require("fs");
const { open, readFile, writeFile, readdir, unlink } = require("fs/promises");

const basePath = __dirname; // serving files from here

let GALLERY_PATH = "/app/tmp";

// if the optional env var 'MOUNT_LOCATION' is not set, but a bucket has been mounted to /mnt/bucket assume it is a COS mount
let isCosEnabled = false;
if (process.env.MOUNT_LOCATION || existsSync("/mnt/bucket")) {
  isCosEnabled = true;
  GALLERY_PATH = process.env.MOUNT_LOCATION || "/mnt/bucket";
}

function sendResponse(res, statusCode, responseMessage) {
  res.statusCode = statusCode;
  return res.end(responseMessage);
}

function getFunctionEndpoint() {
  if (!process.env.COLORIZER) {
    return undefined;
  }
  return `http://${process.env.COLORIZER}.${process.env.CE_SUBDOMAIN}.function.cluster.local`;
}

async function invokeColorizeFunction(imageId) {
  const colorizedResponse = await fetch(getFunctionEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: `{"imageId": "${imageId}"}`,
  });
  const colorized = await colorizedResponse.json();
  if (colorized.error) {
    throw new Error(colorized.error);
  }
  return colorized;
}

const mimetypeByExtension = Object.assign(Object.create(null), {
  css: "text/css",
  html: "text/html",
  jpg: "image/jpeg",
  js: "text/javascript",
  png: "image/png",
});

async function handleHttpReq(req, res) {
  let reqPath = req.url;
  if (reqPath.startsWith("//")) {
    reqPath = reqPath.slice(1);
  }
  console.log(`Got: ${reqPath}`);
  if (reqPath === "/") {
    let pageContent;
    try {
      pageContent = await readFile(`${basePath}/page.html`);
    } catch (err) {
      console.log(`Error reading page: ${err.message}`);
      return sendResponse(res, 503, `Error reading page: ${err.message}`);
    }
    return sendResponse(res, 200, pageContent);
  }

  // This handler exposes the set of features that are available
  if (reqPath === "/features") {
    res.writeHead(200, { "Content-Type": "application/json" });

    const enabledFeatures = {};

    if (existsSync(GALLERY_PATH)) {
      enabledFeatures.fs = {
        cos: isCosEnabled,
      };
    }
    if (process.env.COLORIZER) {
      enabledFeatures.colorizer = {
        fn: getFunctionEndpoint(),
      };
    }
    res.write(JSON.stringify(enabledFeatures));
    res.end();
    return;
  }

  // This handler passes the req payload to a function that is in charge to colorize it
  if (reqPath === "/change-colors") {
    req.on("error", (err) => {
      console.log(`Error reading body: ${err.message}`);
      return sendResponse(res, 503, `Error reading body: ${err.message}`);
    });
    let bodyBuf = Buffer.alloc(0);
    req.on("data", (chunkBuf) => {
      bodyBuf = Buffer.concat([bodyBuf, chunkBuf]);
    });
    req.on("end", () => {
      const payloadStr = bodyBuf.toString("utf-8");
      console.log(`received '${payloadStr}' as input data`);
      const payload = JSON.parse(payloadStr);

      invokeColorizeFunction(payload.imageId)
        .then((response) => {
          console.log(`Colorizer function has been invoked successfully: '${JSON.stringify(response)}'`);
          return sendResponse(res, 200);
        })
        .catch((err) => {
          console.error(`Error colorizing image '${payload.imageId}'`, err);

          if (err.message.indexOf("Access is denied due to invalid credentials") > -1) {
            return sendResponse(res, 403, `Failed due to access permission issues`);
          }
          return sendResponse(res, 503, `Error changing color of image '${payload.imageId}': ${err.message}`);
        });
    });
    return;
  }

  // This handler takes care of uploading the input payload to a local file system location
  if (reqPath === "/upload") {
    console.info("Uploading to COS ...");
    req.on("error", (err) => {
      console.log(`Error reading body: ${err.message}`);
      return sendResponse(res, 503, `Error reading body: ${err.message}`);
    });
    let bodyBuf = Buffer.alloc(0);
    req.on("data", (chunkBuf) => {
      bodyBuf = Buffer.concat([bodyBuf, chunkBuf]);
    });
    req.on("end", async () => {
      console.log(`received ${bodyBuf.toString("base64").length} chars as input data`);
      try {
        await writeFile(`${GALLERY_PATH}/gallery-pic-${Date.now()}.png`, bodyBuf, {});
        res.setHeader("Content-Type", "application/json");
        return sendResponse(res, 200, `{"done": "true"}`);
      } catch (err) {
        console.log(`Error uploading picture: ${err}`);
        return sendResponse(res, 503, `Error uploading picture: ${err}`);
      }
    });
    return;
  }

  // Handler for listing all items in the gallery
  if (reqPath === "/list-gallery-content") {
    try {
      const filenames = await readdir(GALLERY_PATH);
      const galleryContents = filenames.map((file) => {
        // will also include directory names
        console.log(file);
        return {
          Key: file,
          LastModified: Date.now(),
        };
      });

      res.setHeader("Content-Type", "application/json");
      return sendResponse(res, 200, JSON.stringify(galleryContents));
    } catch (err) {
      console.log(`Error listing gallery content: ${err}`);
      return sendResponse(res, 503, `Error listing gallery content: ${err}`);
    }
  }

  // Handler for deleting all items in the gallery
  if (reqPath === "/delete-gallery-content") {
    console.info("Delete entire gallery content ...");

    try {
      for (const file of await readdir(GALLERY_PATH)) {
        await unlink(`${GALLERY_PATH}/${file}`);
      }
      res.setHeader("Content-Type", "application/json");
      return sendResponse(res, 200, `{"done": "true"}`);
    } catch (err) {
      console.log(`Error deleting gallery content: ${err}`);
      return sendResponse(res, 503, `Error deleting gallery content: ${err}`);
    }
    return;
  }

  if (reqPath.indexOf("/image/") > -1) {
    let pictureId = reqPath.substring("/image/".length);
    if (pictureId.indexOf("?") > -1) {
      pictureId = pictureId.substring(0, pictureId.indexOf("?"));
    }
    console.info(`Render image from gallery '${pictureId}' ...`);

    try {
      const fd = await open(`${GALLERY_PATH}/${pictureId}`);
      return fd.createReadStream().pipe(res);
    } catch (err) {
      console.error(`Error streaming gallery content '${pictureId}'`, err);
      return sendResponse(res, 503, `Error streaming gallery content: ${err}`);
    }
  }

  // all other requests
  while (reqPath.startsWith("/")) {
    reqPath = reqPath.slice(1);
  }
  if (reqPath.includes("..")) {
    console.log(`Bad path "${reqPath}"`);
   return sendResponse(res, 404, "Bad path");
  }
  // serve file at basePath/reqPath
  let pageContent;
  try {
    pageContent = await readFile(`${basePath}/${reqPath}`);
  } catch (err) {
    console.log(`Error reading file: ${err.message}`);
    return sendResponse(res, 404, `Error reading file: ${err.message}`);
  }
  res.setHeader("Content-Type", mimetypeByExtension[(reqPath.match(/\.([^.]+)$/) || [])[1]] || "text/plain");
  return sendResponse(res, 200, pageContent);
}

const server = createServer(handleHttpReq);
server.listen(8080, () => {
  console.log(`Listening on port 8080`);
});

process.on("SIGTERM", () => {
  console.info("SIGTERM signal received.");
  server.close(() => {
    console.log("Http server closed.");
  });
});
