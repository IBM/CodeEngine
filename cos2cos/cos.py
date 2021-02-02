from ibm_boto3.session import Session
from ibm_botocore.client import Config
from pathlib import PurePath


class CloudObjectStorage():
    def __init__(self, api_key=None, instance_id=None, iam_endpoint=None,
                 cos_endpoint=None):
        self.cos_endpoint = cos_endpoint
        self.session = Session(
            ibm_api_key_id=api_key,
            ibm_service_instance_id=instance_id,
            ibm_auth_endpoint=iam_endpoint)

        # The COS sdk call download_file() downloads to a local file.
        # If you have an object which implements file-like behavior
        # (e.g. it supports write() and can store bytes)
        # you can pass that into a call to
        # download_fileobj() instead of download_file().
        # You would then need to change the implemention of put_file()
        # to call upload_fileobj() and pass in your object instead of
        # the file name.

    def get_file(self, bucket_name=None, file=None):
        cos = self.session.resource(
            service_name='s3',
            endpoint_url=self.cos_endpoint,
            config=Config(signature_version='oauth')
        )
        response = cos.Bucket(bucket_name).download_file(
            Key=PurePath(file).name,
            Filename=file
        )
        return response

    def put_file(self, bucket_name=None, file=None):
        cos = self.session.resource(
            service_name='s3',
            endpoint_url=self.cos_endpoint,
            config=Config(signature_version='oauth')
        )
        cos.Bucket(bucket_name).upload_file(file, PurePath(file).name)

    def delete_file(self, bucket_name=None, file=None):
        cos = self.session.resource(
            service_name='s3',
            endpoint_url=self.cos_endpoint,
            config=Config(signature_version='oauth')
        )
        response = cos.Bucket(bucket_name).delete_objects(
            Delete={
                'Objects': [
                    {'Key': file}
                ],
                'Quiet': True
                },
            MFA='string',
            RequestPayer='requester'
        )
        if 'Errors' in response.keys():
            raise COSError

    # get_files returns a dict.  The key is the object key,
    # the value is a dict containing core object metadata.
    # See https://ibm.github.io/ibm-cos-sdk-python/reference/services/s3.html#S3.ObjectVersion

    def get_files_info(self, bucket_name=None):
        cos = self.session.resource(
            service_name='s3',
            endpoint_url=self.cos_endpoint,
            config=Config(signature_version='oauth')
        )
        files = {}
        object_summaries = cos.Bucket(bucket_name).objects.all()
        for s in object_summaries:
            object = s.Object()
            files[object.key] = {'last_modified': object.last_modified,
                                 'size': object.content_length,
                                 'version': object.version_id}
        return files


class COSError(Exception):
    """Exception class for errors when interacting with COS."""
    pass
