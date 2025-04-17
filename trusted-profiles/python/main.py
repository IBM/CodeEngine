import os
import requests
import xmltodict

from ibm_cloud_sdk_core.authenticators import ContainerAuthenticator

if __name__ == '__main__':
    # read environment variables
    cosBucket = os.getenv('COS_BUCKET')
    if cosBucket is None:
        print('environment variable COS_BUCKET is not set')
        exit(1)

    cosRegion = os.getenv('COS_REGION')
    if cosRegion is None:
        print('environment variable COS_REGION is not set')
        exit(1)

    trustedProfileName = os.getenv('TRUSTED_PROFILE_NAME')
    if trustedProfileName is None:
        print('environment variable TRUSTED_PROFILE_NAME is not set')
        exit(1)

    # create an authenticator based on a trusted profile
    authenticator = ContainerAuthenticator(iam_profile_name=trustedProfileName)

    # prepare the request to list the files in the bucket
    request = {
        'method': 'GET',
        'url': 'https://s3.direct.{cosRegion}.cloud-object-storage.appdomain.cloud/{cosBucket}'.format(cosRegion=cosRegion, cosBucket=cosBucket),
        'headers': {}
    }

    # authenticate the request
    authenticator.authenticate(request)

    # perform the request
    response = requests.request(**request)
    if response.status_code != 200:
        print('Unexpected status code: {status}'.format(status=response.status_code))
        exit(1)

    # parse the response
    parsedBody = xmltodict.parse(response.content)

    # the XML parser does not know when something is an array if only one item is there
    contents = []
    if type(parsedBody['ListBucketResult']['Contents']) is list:
        # multiple items
        contents = parsedBody['ListBucketResult']['Contents']
    elif type(parsedBody['ListBucketResult']['Contents']) is dict:
        # single items
        contents.append(parsedBody['ListBucketResult']['Contents'])

    print('Found {length} objects:'.format(length=len(contents)))
    for content in contents:
       print('- {item}'.format(item=content['Key']))
