"use strict";

const { createServer } = require("http");
const { readFileSync } = require("fs");
const { CosService } = require("./cos-service");

const basePath = __dirname; // serving files from here

const getCosConfig = () => {
  const endpoint =
    process.env.CLOUD_OBJECT_STORAGE_ENDPOINT ||
    "s3.eu-de.cloud-object-storage.appdomain.cloud";
  const serviceInstanceId =
    process.env.CLOUD_OBJECT_STORAGE_RESOURCE_INSTANCE_ID;
  const apiKeyId = process.env.CLOUD_OBJECT_STORAGE_APIKEY;
  console.log(
    `getCosConfig - endpoint: '${endpoint}', serviceInstanceId: ${serviceInstanceId}, apiKeyId: '${
      apiKeyId && "*****"
    }'`
  );

  return {
    endpoint,
    apiKeyId,
    serviceInstanceId,
  };
};

// Init COS
let cosService;
if (process.env.CLOUD_OBJECT_STORAGE_APIKEY) {
  cosService = new CosService(getCosConfig());
}

function getFunctionEndpoint() {
  if (!process.env.COLORIZER) {
    return undefined;
  }
  return `https://${process.env.COLORIZER}.${process.env.CE_SUBDOMAIN}.${process.env.CE_DOMAIN}`;
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

function handleHttpReq(req, res) {
  let reqPath = req.url;
  if (reqPath.startsWith("//")) {
    reqPath = reqPath.slice(1);
  }
  console.log(`Got: ${reqPath}`);
  if (reqPath === "/") {
    let pageContent;
    try {
      pageContent = readFileSync(`${basePath}/page.html`);
    } catch (err) {
      console.log(`Error reading page: ${err.message}`);
      res.statusCode = 503;
      res.end(`Error reading page: ${err.message}`);
      return;
    }
    res.statusCode = 200;
    res.end(pageContent);
    return;
  }

  // This handler exposes the set of features that are available
  if (reqPath === "/features") {
    res.writeHead(200, { "Content-Type": "application/json" });

    const enabledFeatures = {};

    if (process.env.BUCKET && process.env.CLOUD_OBJECT_STORAGE_APIKEY) {
      enabledFeatures.cos = {
        bucket: process.env.BUCKET,
        interval: parseInt(process.env.CHECK_INTERVAL) || 1_000,
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
      res.statusCode = 503;
      res.end(`Error reading body: ${err.message}`);
      return;
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
          console.log(
            `Colorizer function has been invoked successfully: '${JSON.stringify(
              response
            )}'`
          );
          res.statusCode = 200;
          res.end();
        })
        .catch((reason) => {
          console.error(`Error colorizing image '${payload.imageId}'`, reason);
          res.statusCode = 503;
          res.end(
            `Error changing color of image '${payload.imageId}': ${reason}`
          );
          return;
        });
    });
    return;
  }

  // This handler takes care of uploading the input payload to a COS bucket
  if (reqPath === "/upload") {
    console.info("Uploading to COS ...");
    req.on("error", (err) => {
      console.log(`Error reading body: ${err.message}`);
      res.statusCode = 503;
      res.end(`Error reading body: ${err.message}`);
      return;
    });
    let bodyBuf = Buffer.alloc(0);
    req.on("data", (chunkBuf) => {
      bodyBuf = Buffer.concat([bodyBuf, chunkBuf]);
    });
    req.on("end", () => {
      console.log(
        `received ${bodyBuf.toString("base64").length} chars as input data`
      );
      cosService
        .createObject(
          process.env.BUCKET,
          `gallery-pic-${Date.now()}.png`,
          bodyBuf,
          "image/png"
        )
        .then((thumbnail) => {
          res.setHeader("Content-Type", "application/json");
          res.statusCode = 200;
          res.end(`{"done": "true"}`);
        })
        .catch((reason) => {
          console.log(`Error uploading picture: ${reason}`);
          res.statusCode = 503;
          res.end(`Error uploading picture: ${reason}`);
          return;
        });
    });
    return;
  }

  // Handler for listing all items in the bucket
  if (reqPath === "/list-bucket-content") {
    // console.info("List from COS ...");

    cosService
      .getBucketContents(process.env.BUCKET, "")
      .then((bucketContents) => {
        res.setHeader("Content-Type", "application/json");
        res.statusCode = 200;
        res.end(JSON.stringify(bucketContents));
      })
      .catch((reason) => {
        console.log(`Error listing bucket content: ${reason}`);
        res.statusCode = 503;
        res.end(`Error listing bucket content: ${reason}`);
        return;
      });
    return;
  }

  // Handler for deleting all items in the bucket
  if (reqPath === "/delete-bucket-content") {
    console.info("Delete entire bucket content ...");

    cosService
      .getBucketContents(process.env.BUCKET, "")
      .then((bucketContents) => {
        return bucketContents.map((obj) => {
          return {
            Key: obj.Key,
          };
        });
      })
      .then((toBeDeletedObjects) => {
        return cosService.deleteBucketObjects(
          process.env.BUCKET,
          toBeDeletedObjects
        );
      })
      .then(() => {
        res.setHeader("Content-Type", "application/json");
        res.statusCode = 200;
        res.end(`{"done": "true"}`);
      })
      .catch((reason) => {
        console.log(`Error deleting bucket content: ${reason}`);
        res.statusCode = 503;
        res.end(`Error deleting bucket content: ${reason}`);
        return;
      });
    return;
  }

  if (reqPath.indexOf("/image/") > -1) {
    let pictureId = reqPath.substring("/image/".length);
    if (pictureId.indexOf("?") > -1) {
      pictureId = pictureId.substring(0, pictureId.indexOf("?"));
    }
    console.info(`Render image from COS '${pictureId}' ...`);

    try {
      return cosService.streamObject(process.env.BUCKET, pictureId, res);
    } catch (err) {
      console.error(`Error streaming bucket content '${pictureId}'`, err);
      res.statusCode = 503;
      res.end(`Error streaming bucket content: ${err}`);
      return;
    }
  }

  // all other requests
  while (reqPath.startsWith("/")) {
    reqPath = reqPath.slice(1);
  }
  if (reqPath.includes("..")) {
    console.log(`Bad path "${reqPath}"`);
    res.statusCode = 404;
    res.end("Bad path");
    return;
  }
  // serve file at basePath/reqPath
  let pageContent;
  try {
    pageContent = readFileSync(`${basePath}/${reqPath}`);
  } catch (err) {
    console.log(`Error reading file: ${err.message}`);
    res.statusCode = 404;
    res.end(`Error reading file: ${err.message}`);
    return;
  }
  res.setHeader(
    "Content-Type",
    mimetypeByExtension[(reqPath.match(/\.([^.]+)$/) || [])[1]] || "text/plain"
  );
  res.statusCode = 200;
  res.end(pageContent);
}

const server = createServer(handleHttpReq);
server.listen(8080, () => {
  console.log(`Listening on port 8080`);
});

process.on('SIGTERM', () => {
  console.info('SIGTERM signal received.');
  server.close(() => {
    console.log('Http server closed.');
  });
});