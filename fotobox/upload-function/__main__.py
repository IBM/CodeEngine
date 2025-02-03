import base64
import os
import datetime
import ibm_boto3
from ibm_botocore.client import Config
import string
import random
from PIL import Image, ImageOps

COS_ENDPOINT = "https://s3.eu-de.cloud-object-storage.appdomain.cloud"
COS_API_KEY = os.environ.get('apikey', "apikey")
COS_INSTANCE_CRN =os.environ.get('resource_instance_id', "resource_instance_id")
COS_BUCKET_NAME = os.environ.get('bucket', "fotobox")

IMG_PREFIX = os.environ.get("imageprefix","fotobox-prefix-")


alphabet = string.ascii_lowercase + string.digits
def random_choice():
    return ''.join(random.choices(alphabet, k=8))

def process_image(params):
    # Extract the base64 string from the 'image' field in the params dictionary
    image_base64 = params.get('image', '')

    if not image_base64:
        raise ValueError("No image data provided.")

    # Decode the base64 string
    image_data = base64.b64decode(image_base64)

    datetime_str = datetime.datetime.fromtimestamp(int(datetime.datetime.now().timestamp())).strftime("%Y-%m-%d-%H-%M-%S")


    # Specify the file path where the image will be saved
    image_file_path = f'{IMG_PREFIX}{datetime_str}-{random_choice()}.png'

    # Save the decoded image data to a file
    with open(image_file_path, 'wb') as image_file:
        image_file.write(image_data)

    return image_file_path


def create_thumbnail_with_padding(input_path, size=(384, 216), background_color=(255, 255, 255)):
    """
    Creates a thumbnail from a PNG image with padding to ensure a consistent aspect ratio.

    Parameters:
    - input_path (str): The file path of the input PNG image.
    - size (tuple): The target size of the thumbnail (width, height).
    - background_color (tuple): RGB color for padding, default is white (255, 255, 255).
    """
    output_path = f"thumbnail-{input_path}"
    try:
        # Open the input image
        with Image.open(input_path) as img:
            # Resize the image, maintaining the aspect ratio
            img.thumbnail(size, Image.LANCZOS)

            # Create a new image with the desired size and background color
            padded_img = Image.new("RGB", size, background_color)
            # Calculate position to center the resized image on the background
            offset = ((size[0] - img.width) // 2, (size[1] - img.height) // 2)
            # Paste the resized image onto the background
            padded_img.paste(img, offset)

            # Save the padded thumbnail
            padded_img.save(output_path, "PNG")
        print(f"Thumbnail with padding saved to {output_path}")
        return output_path
    except Exception as e:
        print(f"An error occurred: {e}")
        return ""

def upload_file_to_cos(file_path, object_name):
    try:
        # Create a client for IBM COS
        cos = ibm_boto3.client(
            's3',
            ibm_api_key_id=COS_API_KEY,
            ibm_service_instance_id=COS_INSTANCE_CRN,
            config=Config(signature_version='oauth'),
            endpoint_url=COS_ENDPOINT
        )

        # Upload file
        with open(file_path, 'rb') as file_data:
            cos.upload_fileobj(file_data, COS_BUCKET_NAME, object_name)

        print(f"File {object_name} uploaded successfully to bucket {COS_BUCKET_NAME}")
        return True
    except Exception as e:
        print(f"Unable to upload file: {e}")
        return False


def main(params):

    image_path = process_image(params)
    thumbnail_path = create_thumbnail_with_padding(image_path)
    success = upload_file_to_cos(image_path, image_path)
    if thumbnail_path != "" and success: 
        success = upload_file_to_cos(thumbnail_path, thumbnail_path)


    rspstatus = 200
    if not success: 
        rspstatus = 500
    return {
            "headers": {
                "Content-Type": "application/json",
            },
            "statusCode": rspstatus,
            "body": {"image": image_path, "thumbnail":thumbnail_path}
    }