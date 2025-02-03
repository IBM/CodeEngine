# IBM Fotobox

1. Setup COS with cos bucket this can be done over the UI or using the CLI  
    note dont the bucket name and API credentials

2. Deploy the Upload Function using the CLI
    ```bash
    ibmcloud ce fn create --name fotobox-cos-upload  --runtime python  --build-source upload-function
    ```

3. Deploy the Download App using the CLI
    ```bash
    ibmcloud ce app create --name fotobox-get-pics --build-dockerfile Dockerfile  --build-source download-app
    ```

4. Create a Secret map containing the following values. use the following command to create the password
    ```bash
    echo -n "password" | sha256
    5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8

    ```
    Secrets/environment variables
    ```
    apikey="cos api key mus upload und download können"
    resource_instance_id="cos credential"
    bucket="mybucket"
    imageprefix="my-event-"
    passwords="5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8"
    ```

5. Reference the full secret to the function and the app

6. inside the the [stores.js](frontend-app/src/stores.js) replace the URLs to the upload function and download app


```javascript
export const uploadURL = "<replace with public function url>"
export const downloadURL = "<replace with download app url"
```

7. Deploy the app with the updates
```bash
ibmcloud ce app create --name fotobox-frontend --build-dockerfile Dockerfile  --build-source frontend-app
```

Now the Fotobox should be deployed and usable