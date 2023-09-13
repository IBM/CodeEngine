/*******************************************************************************
 * Licensed Materials - Property of IBM
 * IBM Cloud Code Engine, 5900-AB0
 * © Copyright IBM Corp. 2020, 2022
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 ******************************************************************************/

const ibm = require("ibm-cos-sdk");

class CosService {
  cos;
  config;

  constructor(config) {
    const fn = "constructor";
    this.config = config;
    this.cos = new ibm.S3(config);
    console.debug(
      `${fn}- initialized! instance: '${config.serviceInstanceId}'`
    );
  }

  getServiceInstanceId() {
    return this.config.serviceInstanceId;
  }

  getContentTypeFromFileName(fileName) {
    if (fileName.endsWith(".png")) {
      return "image/png";
    }
    if (fileName.endsWith(".jpg")) {
      return "image/jpeg";
    }
    if (fileName.endsWith(".xml")) {
      return "application/xml";
    }
    if (fileName.endsWith(".json")) {
      return "application/json";
    }
    if (fileName.endsWith(".html")) {
      return "text/html";
    }
    if (fileName.endsWith(".log")) {
      return "text/plain";
    }
    if (fileName.endsWith(".css")) {
      return "text/css";
    }
    if (fileName.endsWith(".js")) {
      return "text/javascript";
    }
    if (fileName.endsWith(".svg")) {
      return "image/svg+xml";
    }

    return "text/plain";
  }

  /**
   * https://ibm.github.io/ibm-cos-sdk-js/AWS/S3.html#putObject-property
   */
  createObject(bucket, id, dataToUpload, mimeType, contentLength) {
    const fn = "createObject ";
    console.debug(`${fn}> id: '${id}', mimeType: '${mimeType}', contentLength: '${contentLength}'`);

    return this.cos
      .putObject({
        Bucket: bucket,
        Key: id,
        Body: dataToUpload,
        ContentType: mimeType,
        ContentLength: contentLength,
      })
      .promise()
      .then((obj) => {
        console.debug(`${fn}< done`);
        return true;
      })
      .catch((err) => {
        console.error(err);
        console.debug(`${fn}< failed`);
        throw err;
      });
  }

  /**
   * https://cloud.ibm.com/docs/cloud-object-storage?topic=cloud-object-storage-node#node-examples-list-objects
   */
  getBucketContents(bucketName, prefix) {
    const fn = "getBucketContents ";
    console.debug(`${fn}> bucket: '${bucketName}', prefix: '${prefix}'`);
    return this.cos
      .listObjects({ Bucket: bucketName, Prefix: prefix })
      .promise()
      .then((data) => {
        console.debug(`${fn}< done`);
        if (data != null && data.Contents != null) {
          return data.Contents;
        }
      })
      .catch((err) => {
        console.error(err);
        console.debug(`${fn}< failed`);
        return undefined;
      });
  }

  /**
   * https://ibm.github.io/ibm-cos-sdk-js/AWS/S3.html#getObject-property
   * @param id
   */
  getObjectAsStream(bucket, id) {
    const fn = "getObjectAsStream ";
    console.debug(`${fn}> id: '${id}'`);

    return this.cos.getObject({ Bucket: bucket, Key: id }).createReadStream();
  }
}

module.exports = {
  CosService,
};
