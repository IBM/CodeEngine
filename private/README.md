# Private

Demo that shows how to create a "private" application that is only accessible
from within the Code Engine product. Meaning, it does not have an external
endpoint/URL that is reachable from the internal.

In this example we'll create 2 apps, `frontend` and `backend`. `frontend`
will be a normall app, accessible from the internet. `backend` is private and
is only accessible to `frontend`. Calling `frontend` will `curl` the `backend`
app and then include its response in the output back to the user.

- - -

As noted in [the main README](../README.md), this sample has two pieces:

- a `build` script which will build the container image(s) used
- a `run` script which deploys resources that use those images

The main purpose of this example is the `run` script, but the `build`
script is included for complete educational (and reuse) purposes. 
