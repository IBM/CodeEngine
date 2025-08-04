/*******************************************************************************
 * Licensed Materials - Property of IBM
 * IBM Cloud Code Engine, 5900-AB0
 * © Copyright IBM Corp. 2020, 2022
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 ******************************************************************************/

const { ContainerAuthenticator } = require("ibm-cloud-sdk-core");
const { Readable } = require('node:stream');

const responseToReadable = (response) => {
  const reader = response.body.getReader();
  const rs = new Readable();
  rs._read = async () => {
    const result = await reader.read();
    if (!result.done) {
      rs.push(Buffer.from(result.value));
    } else {
      rs.push(null);
      return;
    }
  };
  return rs;
};
class CosService {
  config;
  authenticator;

  constructor(config) {
    const fn = "constructor";
    this.config = config;

    // create an authenticator based on a trusted profile
    this.authenticator = new ContainerAuthenticator({
      iamProfileName: config.trustedProfileName,
    });
    console.log(
      `CosService init - region: '${this.config.cosRegion}', bucket: ${this.config.cosBucket}, trustedProfileName: '${this.config.trustedProfileName}'`
    );
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
  async createObject(id, dataToUpload, mimeType, contentLength) {
    const fn = "createObject ";
    console.debug(`${fn}> id: '${id}', mimeType: '${mimeType}', contentLength: '${contentLength}'`);

    // prepare the request to create the object files in the bucket
    const requestOptions = {
      method: "PUT",
      body: dataToUpload,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": contentLength,
      },
    };

    // authenticate the request
    await this.authenticator.authenticate(requestOptions);

    // perform the request
    const response = await fetch(
      `https://s3.direct.${this.config.cosRegion}.cloud-object-storage.appdomain.cloud/${this.config.cosBucket}/${id}`,
      requestOptions
    );

    if (response.status !== 200) {
      console.error(`Unexpected status code: ${response.status}`);
      throw new Error(`Failed to upload image: '${response.status}'`);
    }
    return;
  }

  /**
   * https://ibm.github.io/ibm-cos-sdk-js/AWS/S3.html#getObject-property
   * @param id
   */
  async getObjectAsStream(id) {
    const fn = "getObjectAsStream ";
    console.debug(`${fn}> id: '${id}'`);

    // prepare the request to list the files in the bucket
    const requestOptions = {
      method: "GET",
    };

    // authenticate the request
    await this.authenticator.authenticate(requestOptions);

    // perform the request
    return fetch(
      `https://s3.direct.${this.config.cosRegion}.cloud-object-storage.appdomain.cloud/${this.config.cosBucket}/${id}`,
      requestOptions
    ).then((response) => {
      if (!response.ok) {
        console.error(`${fn}< HTTP error, status = ${response.status}`);
        throw new Error(`HTTP error, status = ${response.status}`);
      }
      console.debug(`${fn}< receiving response as readable stream`);
      return responseToReadable(response);
    });
  }
}

module.exports = {
  CosService,
};
