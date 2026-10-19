// COS bucket names: 3-63 chars; lowercase letters, digits, dots and hyphens; start/end with letter or digit
const BUCKET_NAME_PATTERN = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
// COS regions, e.g. 'eu-de', 'us-south'
const REGION_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Builds the COS object URL from validated parts, so that user-provided values can neither change the host nor the path prefix
function buildObjectUrl(region, bucket, key) {
  if (typeof region !== "string" || !REGION_PATTERN.test(region)) {
    throw new Error("Invalid COS region");
  }
  if (typeof bucket !== "string" || !BUCKET_NAME_PATTERN.test(bucket)) {
    throw new Error("Invalid COS bucket name");
  }
  if (typeof key !== "string" || key.length === 0 || key.length > 1024) {
    throw new Error("Invalid COS object key");
  }
  const segments = key.split("/");
  // reject path traversal; empty segments (e.g. leading '/') are not valid for a COS key either
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error("Invalid COS object key");
  }
  const encodedKey = segments.map(encodeURIComponent).join("/");
  return `https://s3.direct.${region}.cloud-object-storage.appdomain.cloud/${bucket}/${encodedKey}`;
}

export async function getObjectContent(authenticator, region, bucket, key) {
  const fn = "getObjectContent ";
  const startTime = Date.now();

  let objectUrl;
  try {
    objectUrl = buildObjectUrl(region, bucket, key);
  } catch (err) {
    return Promise.reject(err);
  }
  console.log(`${fn} > region: '${region}', bucket: '${bucket}', key: '${key}'`);

  // prepare the request to download the content of a file
  const requestOptions = {
    method: "GET",
  };

  // authenticate the request
  await authenticator.authenticate(requestOptions);

  // perform the request
  const response = await fetch(objectUrl, requestOptions);

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
