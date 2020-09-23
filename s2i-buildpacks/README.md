# Source-to-Image with Buildpacks

This sample shows how to use the Code Engine source-to-image feature using
Buildpacks to build your application from a git repo, push the image into a
registry, and then deploy it as a Code Engine application. It doesn't require
a Dockerfile in the git repo.

More details and supported runtimes and versions can be found in [Code Engine
Docs](https://cloud.ibm.com/docs/codeengine?topic=codeengine-plan-build).

The exact steps taken in [`run`](./run) are:
- Create an ICR (IBM Container Registry) namespace to store the resulting image
- Create an IBM API Key that will be used by the build process to push the
  image to ICR
- Define a build that points to a git repo for the source, and then defines
  where in ICR to store the image
- Creates a Code Engine app from that image
