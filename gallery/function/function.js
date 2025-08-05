"use strict";

const { changeColors } = require("./colorizer");
const { CosService } = require("./cos-service");

// helper function to craft a proper function result object
function sendJSONResponse(statusCode, responseBody) {
  return {
    statusCode: statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: responseBody,
  };
}

// helper function to craft a proper COS config
const getCosConfig = () => {
  return {
    cosBucket: process.env.COS_BUCKET,
    cosRegion: process.env.COS_REGION || process.env.CE_REGION,
    trustedProfileName: process.env.TRUSTED_PROFILE_NAME,
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
if (process.env.COS_BUCKET && process.env.TRUSTED_PROFILE_NAME) {
  cosService = new CosService(getCosConfig());
  console.log(`Initialized COS Service`);
}

async function main(args) {
  // Check whether COS has been configured properly
  if (!cosService) {
    console.log(
      `Aborting. COS has not been configured properly. The env variables 'COS_BUCKET' and 'TRUSTED_PROFILE_NAME' must be set properly.`
    );
    return sendJSONResponse(
      401,
      `{"error":"COS has not been configured properly. The env variables 'COS_BUCKET' and 'TRUSTED_PROFILE_NAME' must be set properly"}`
    );
  }

  // Obtain the COS ID of the image that should be transformed
  const imageId = args.imageId;
  if (!imageId) {
    console.log(`Aborting. Payload parameter imageId is not set properly`);
    return sendJSONResponse(400, `{"error":"Payload parameter imageId is not set properly"}`);
  }

  console.log(`Changing colors of '${imageId}'`);
  try {
    //
    // Fetch the object that should get transformed
    const fileStream = await cosService.getObjectAsStream(imageId);
    console.log(`Downloaded '${imageId}'`);

    //
    // Convert the image stream to a buffer
    const imageBuf = await streamToBuffer(fileStream);
    console.log(
      `Converted to a buffer of size ${(imageBuf.length / 1024).toFixed(1)} KB`
    );

    //
    // Change the color tokens of the image
    const updatedImageBuf = await changeColors(imageBuf);
    console.log(`Adjusted colors of '${imageId}' - new size ${(updatedImageBuf.length / 1024).toFixed(1)} KB`);

    //
    // Upload the adjusted image back into the COS bucket
    await cosService.createObject(
      imageId,
      updatedImageBuf,
      cosService.getContentTypeFromFileName(imageId),
      updatedImageBuf.contentLength
    );
    console.log(`Uploaded updated '${imageId}'`);

    return sendJSONResponse(200, `{"success": "true"}`);
  } catch (err) {
    console.error(`Error changing colors of ${imageId}`, err);
    return sendJSONResponse(503, `{"error":"Error changing colors: ${err.message}"}`);
  }
}

module.exports.main = main;
