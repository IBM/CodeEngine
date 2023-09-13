"use strict";

const { changeColors } = require("./colorizer");
const { CosService } = require("./cos-service");

// helper function to craft a proper COS config
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

// helper function to turn a readable stream into a string buffer
const streamToBuffer = (inputStream) => {
  return new Promise((resolve, reject) => {
    const bufs = [];
    inputStream.on("data", function (d) {
      bufs.push(d);
    });
    inputStream.on("end", function () {
      const buf = Buffer.concat(bufs);
      resolve(buf);
    });
  });
};

// initialize the COS service
let cosService;
if (process.env.CLOUD_OBJECT_STORAGE_APIKEY) {
  cosService = new CosService(getCosConfig());
  console.log(`Initialized COS Service`);
}
const bucket = process.env.BUCKET;
console.log(`Target bucket: '${bucket}'`);

async function main(args) {
  // Check whether COS has been configured properly
  if (!cosService || !bucket) {
    console.log(
      `Aborting. COS has not been configured properly. Either the binding with the prefix 'CLOUD_OBJECT_STORAGE_' or the env var 'BUCKET' are missing.`
    );
    return {
      statusCode: 401,
      headers: {
        "Content-Type": "application/json",
      },
      body: `{"error":"Target IBM Cloud Object Storage instance has not been bound properly"}`,
    };
  }

  // Obtain the COS ID of the image that should be transformed
  const imageId = args.imageId;
  if (!imageId) {
    console.log(
      `Aborting. Payload parameter imageId is not set properly`
    );
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
      },
      body: `{"error":"Payload parameter imageId is not set properly"}`,
    };
  }

  console.log(`Changing colors of '${imageId}'`);
  try {
    // Fetch the object that should get transformed
    const fileStream = await cosService.getObjectAsStream(bucket, imageId);
    console.log(`Downloaded '${imageId}'`);

    // Convert the image stream to a buffer
    const imageBuf = await streamToBuffer(fileStream);
    console.log(
      `Converted to a buffer of size ${(imageBuf.length / 1024).toFixed(1)} KB`
    );

    // Change the color tokens of the image
    const updatedImageBuf = await changeColors(imageBuf);
    console.log(
      `Adjusted colors of '${imageId}' - new size ${(
        updatedImageBuf.length / 1024
      ).toFixed(1)} KB`
    );

    // SIXTH upload the adjusted image back into the COS bucket
    await cosService.createObject(
      bucket,
      imageId,
      updatedImageBuf,
      cosService.getContentTypeFromFileName(imageId),
      updatedImageBuf.contentLength
    );
    console.log(`Uploaded updated '${imageId}'`);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: `{"success": "true"}`,
    };
  } catch (reason) {
    console.error(`Error changing colors of ${imageId}`, reason);
    return {
      statusCode: 503,
      headers: {
        "Content-Type": "application/json",
      },
      body: `{"error":"Error changing colors: ${reason}"}`,
    };
  }
}

module.exports.main = main;
