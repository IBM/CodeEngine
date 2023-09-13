"use strict";

const { CosService } = require("./cos-service");
const { changeColors } = require("./colorizer");

// Check whether COS has been configured properly
if (!process.env.CLOUD_OBJECT_STORAGE_APIKEY || !process.env.BUCKET) {
  process.exit(1);
}

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
const cosService = new CosService(getCosConfig());
const bucket = process.env.BUCKET;

const run = async () => {
  // FIRST we list all the items in the bucket
  let bucketContents;
  try {
    bucketContents = await cosService.getBucketContents(bucket, "");
  } catch (reason) {
    console.error(`Error reading bucket contents of '${bucket}'`, reason);
    process.exit(1);
  }
  console.log(`Loaded ${bucketContents.length} items from the bucket`);

  // SECOND we iterate on these images
  let idx = 1;
  for (const bucketItem of bucketContents) {
    console.log(
      `${idx}/${bucketContents.length} changing colors of '${
        bucketItem.Key
      }': ${JSON.stringify(bucketItem)} ...`
    );

    try {
      // THIRD obtain a stream of the file
      const fileStream = await cosService.getObjectAsStream(
        bucket,
        bucketItem.Key
      );
      console.log(
        `${idx}/${bucketContents.length} downloaded '${bucketItem.Key}'`
      );

      // FOURTH convert it to a buffered string
      const imageBuf = await streamToBuffer(fileStream);
      console.log(
        `${idx}/${bucketContents.length} converted to a buffer of size ${(
          imageBuf.length / 1024
        ).toFixed(1)} KB`
      );

      // FIFTH convert its colors
      const updatedImageBuf = await changeColors(imageBuf);
      console.log(
        `${idx}/${bucketContents.length} adjusted colors of '${
          bucketItem.Key
        }' - new size ${(updatedImageBuf.length / 1024).toFixed(1)} KB`
      );

      // SIXTH upload the adjusted image back into the COS bucket
      await cosService.createObject(
        bucket,
        bucketItem.Key,
        updatedImageBuf,
        cosService.getContentTypeFromFileName(bucketItem.Key),
        updatedImageBuf.contentLength
      );
      console.log(
        `${idx}/${bucketContents.length} uploaded updated '${bucketItem.Key}'`
      );
    } catch (reason) {
      console.error(
        `Error changing color of item '${bucketItem.Key}' in '${bucket}'`,
        reason
      );
    }
    idx++;
  }
};
run();
