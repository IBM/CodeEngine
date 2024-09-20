# Network Connectivity Test App

This sample is intended to help users debug connectivity issues for IBM Cloud Services. You can use this app to help isolate network connection issues between your own code and a working app.

- - -

This sample includes a `build` script which will build the container image and push the image to `icr.io/codeengine/network-test-app`. The customer should:
- Pull the image `icr.io/codeengine/network-test-app`
- Deploy the image as a job definition
- Run the job and send the output to the support engineer via the support ticket.

## Configuring the Service Credentials for the App

This app works by attempting to connect your Code Engine project to another IBM Cloud service; in order to do this properly, it must consume service credentials that should be configured by creating a `service binding` between the customer's project and the service they wish to connect to.

For more information about how to create a service binding, see [Working with service bindings to integrate IBM Cloud services with Code Engine](https://cloud.ibm.com/docs/codeengine?topic=codeengine-service-binding).

### Example: Databases for PostgreSQL
If the app is attempting to connect to a postgres instance, then after creating a service binding for the instance the app will contain the credentials for the  postgres instance in the form of an environment variable `DATABASES_FOR_POSTGRESQL_CONNECTION`. 
- **Without this environment variable properly configured, the app will NOT be able to connect to postgres**