# OAuth2 / OIDC

A pretty simple golang application that, in its most basic form, will
return "Hello World" back to the caller.

Check the source code for all of the things you can make it do either via
environment variables or query parameters. This is good for testing the
system to see how it reacts - for example, when the app crashes.

Note: we added some extra logic to this so I can also be used as a batch job
but you can ignore that if all you care about is the App side of things.


```
OIDC_CLIENT_ID= > .env
OIDC_CLIENT_SECRET= >> .env
OIDC_PROVIDER_AUTHORIZATION_ENDPOINT= >> .env
OIDC_PROVIDER_TOKEN_ENDPOINT= >> .env
OIDC_PROVIDER_USERINFO_ENDPOINT= >> .env
```

* Create the secret
```
ibmcloud ce secret create --name oidc-credentials --from-env-file .env
```

* Create the application
```
LANGUAGE=go
cd $LANGUAGE
ibmcloud ce app create --name oidc-sample-$LANGUAGE --src . \
    --cpu 0.125 \
    --memory 0.25G \
    --env-from-secret oidc-credentials

OIDC_REDIRECT_URL=$(ibmcloud ce app get -n oidc-sample-$LANGUAGE --output url)
ibmcloud ce app update --name oidc-sample-$LANGUAGE --env OIDC_REDIRECT_URL=$OIDC_REDIRECT_URL/auth/callback
cd ..
```

- - -

As noted in [the main README](../README.md), this sample has two pieces:

- a `build` script which will build the container image(s) used
- a `run` script which deploys resources that use those images

The main purpose of this example is the `run` script, but the `build`
script is included for complete educational (and reuse) purposes.
