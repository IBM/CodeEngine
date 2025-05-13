# OIDC Proxy sample

This sample demonstrates how to configure an authentication/authorization layer that fronts any arbitrary Code Engine application. In principal, this pattern is pretty generic. To demonstrate it, we chose to implement it with OIDC, an authentication framework that is built on top of the OAuth 2.0 protocol.

The following diagram depicts the components that are involved:
![OIDC Proxy architecture overview](./docs/ce-oidc-proxy-overview.png)

**Note:** The origin app is not exposed to the public or private network and can only be accessed through the authentication proxy that does an auth check towards an oidc app that got installed into the same project.


## Setting up an OIDC SSO configuration

### Github.com OIDC SSO

* Create Github OIDC app through https://github.com/settings/developers
    ```
    name: jupyter
    homepage: https://jupyter-auth.<CE_SUBDOMAIN>.<REGION>.codeengine.appdomain.cloud
    callback URL: https://jupyter-auth.<CE_SUBDOMAIN>.<REGION>.codeengine.appdomain.cloud/auth/callback
    ```
* Store the client id and the secret in local file called `oidc.properties`
    ```
    OIDC_CLIENT_ID=<CLIENT_ID>
    OIDC_CLIENT_SECRET=<CLIENT_SECRET>
    ```
* Generate a random cookie secret that is used to encrypt the auth cookie value and add it to the `oidc.properties` file
    ```
    COOKIE_SIGNING_ENCRYPTION_KEY=$(openssl rand -base64 32)
    ```
* From your OIDC provider obtain the following values and add ithem to the `oidc.properties` file
    ```
    OIDC_PROVIDER_AUTHORIZATION_ENDPOINT=https://github.com/login/oauth/authorize
    OIDC_PROVIDER_TOKEN_ENDPOINT=https://github.com/login/oauth/access_token
    OIDC_PROVIDER_USERINFO_ENDPOINT=https://api.github.com/user
    ```
* To add authorization checks one can either check for a specific user property
    ```
    AUTHZ_USER_PROPERTY=login
    AUTHZ_ALLOWED_USERS=<<comma-separated-list-of-github-users>
    ```

### IBMers-only: w3Id OIDC SSO

* Create w3Id OIDC configuration through https://ies-provisioner.prod.identity-services.intranet.ibm.com/tools/sso/home
    ```
    name: jupyter
    homepage: https://jupyter-auth.<CE_SUBDOMAIN>.<REGION>.codeengine.appdomain.cloud
    callback URL: https://jupyter-auth.<CE_SUBDOMAIN>.<REGION>.codeengine.appdomain.cloud/auth/callback
    ```
* Store the client id and the secret in local file called `oidc.properties`
    ```
    OIDC_CLIENT_ID=<CLIENT_ID>
    OIDC_CLIENT_SECRET=<CLIENT_SECRET>
    ```
* Generate a random cookie secret that is used to encrypt the auth cookie value and add it to the `oidc.properties` file
    ```
    COOKIE_SIGNING_ENCRYPTION_KEY=$(openssl rand -base64 32)
    ```
* From your OIDC provider obtain the following values and add ithem to the `oidc.properties` file
    ```
    OIDC_PROVIDER_AUTHORIZATION_ENDPOINT=
    OIDC_PROVIDER_TOKEN_ENDPOINT=
    OIDC_PROVIDER_USERINFO_ENDPOINT=
    ```
* To add authorization checks one can either check for a specific user property, for a group property match
    ```
    AUTHZ_USER_PROPERTY=preferred_username
    AUTHZ_ALLOWED_USERS=<comma-separated-list-of-usernames>
    ```
* Or for a group property match
    ```
    AUTHZ_USER_PROPERTY=blueGroups
    AUTHZ_ALLOWED_USERS=<comma-separated-list-of-groups>
    ```

## Installing the sample

* Install the Code Engine projects and all required components
    ```
    ./run
    ```

* Tear down the example: 
    ```
    ./run clean
    ```

* Install the example and make sure it does not get deleted right-away
    ```
    CLEANUP_ON_SUCCESS=false ./run
    ```

* Following environment variables can be used to tweak the run script

| Name | Description | Default value |
|:----|:---|:---|
| REGION | Region of the Code Engine project | `eu-es` |
| NAME_PREFIX | Naming prefix used for all components (e.g. resource group, Code Engine project, apps)  | `oidc-sample` |
| CLEANUP_ON_SUCCESS | Determines whether the setup should be deleted, right after its successful creation  | `true` |
| CLEANUP_ON_ERROR | Determines whether the setup should be deleted, if the setup procedure failed  | `true` |
