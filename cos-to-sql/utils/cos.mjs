export async function getObjectContent(authenticator, region, bucket, key) {
  const fn = "getObjectContent ";
  const startTime = Date.now();
  console.log(`${fn} > region: '${region}', bucket: '${bucket}', key: '${key}'`);

  // prepare the request to download the content of a file
  const requestOptions = {
    method: "GET",
  };

  // authenticate the request
  await authenticator.authenticate(requestOptions);

  // perform the request
  const response = await fetch(
    `https://s3.direct.${region}.cloud-object-storage.appdomain.cloud/${bucket}/${key}`,
    requestOptions
  );

  if (response.status !== 200) {
    const err = new Error(`Unexpected status code: ${response.status}`);
    console.log(`${fn} < failed - error: ${err.message}; duration ${Date.now() - startTime} ms`);
    return Promise.reject(err);
  }

  // read the response
  const responseBody = await response.text();

  console.log(`${fn} < done - duration ${Date.now() - startTime} ms`);
  return responseBody;
}
