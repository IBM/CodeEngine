import { XMLParser } from 'fast-xml-parser';
import { ContainerAuthenticator } from 'ibm-cloud-sdk-core';

// read environment variables
const cosBucket = process.env.COS_BUCKET;
if (!cosBucket) {
    console.error('environment variable COS_BUCKET is not set');
    process.exit(1);
}

const cosRegion = process.env.COS_REGION;
if (!cosRegion) {
    console.error('environment variable COS_REGION is not set');
    process.exit(1);
}

const trustedProfileName = process.env.TRUSTED_PROFILE_NAME;
if (!trustedProfileName) {
    console.error('environment variable TRUSTED_PROFILE_NAME is not set');
    process.exit(1);
}

// create an authenticator based on a trusted profile
const authenticator = new ContainerAuthenticator({
    iamProfileName: trustedProfileName
});

// prepare the request to list the files in the bucket
const requestOptions = {
    method: 'GET',
};

// authenticate the request
await authenticator.authenticate(requestOptions);

// perform the request
const response = await fetch(`https://s3.direct.${cosRegion}.cloud-object-storage.appdomain.cloud/${cosBucket}`, requestOptions);

if (response.status !== 200) {
    console.error(`Unexpected status code: ${response.status}`);
    process.exit(1);
}

// read the response
const responseBody = await response.text();

// parse the response
const parsedBody = new XMLParser().parse(responseBody);

// the XML parser does not know when something is an array if only one item is there
const contents = [];
if (parsedBody.ListBucketResult.Contents instanceof Array) {
    // multiple items
    contents.push(...parsedBody.ListBucketResult.Contents)
} else if (typeof parsedBody.ListBucketResult.Contents === 'object') {
    // single items
    contents.push(parsedBody.ListBucketResult.Contents);
}

console.log(`Found ${contents.length} objects:`);
contents.forEach((content) => console.log(`- ${content.Key}`));
