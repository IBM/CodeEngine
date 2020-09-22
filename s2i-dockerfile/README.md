# Source-to-Image

This sample shows how to use the Code Engine source-to-image feature
to build your application from a git repo, push the image into a registry,
and then deploy it as a Code Engien application. This will assume that there's
a Dockerfile in the root of the git repo that will be used to build the image.

The exact steps taken in [`run`](./run) are:
- Create an ICR (IBM Container Regsitry) namespace to store the resulting
  image
- Create an IBM API Key that will be used by the build process to push
  the image to ICR
- Define a build that points to a git repo for the source, and the
  defines where in ICR to store the image
- Creates a Code Engine app from that image
