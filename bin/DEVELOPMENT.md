# Guidelines for adding new material

General rules to follow:
- all material must be automatable so that we'll know if things are stale
  or broken. This means that the `bin/run-all*` scripts must be able to find
  and run each one. So each one must have a `run` script in it's top level dir.
- all material must be buildable and executable by anyone. This means that
  each needs to have a `build` and `run` script in it's top level dir.
- the `run` script should have some level of basic testing to verify that
  things worked and not just that everything exited with a zero exit code.
- the `run` script much support an arg of `clean` to just clean up from a
  previous (successful or unsuccessful) execution, and then exit.
- the `run` script needs to run it's "clean" logic before and after the
  normal activities.
- all pre-built images should be stored in `ibmcom` on DockerHub. See
  https://github.ibm.com/open-source/ibmcom/issues for adding new images.
  Team: `coligo`.
- all material must be listed on the top-level README.
- preferred language is Go.
- before submitting a PR make sure `bin/run-all-parallel` works every time.
- Do not create a new project as part of the exercises - it makes it harder
  for the automated testing. Instead you may suggest people can create a new
  one if they want, but it should be optional and the README for a Tutorial
  should use the ">" command syntax so it's not executed, if you choose to
  include the "project create" command in the README.
- If some material needs to be executed serially (and not at the same time
  as any others), add a file called `.SEQ` to the root of that directory.
- All samples need to use free-tier services so that no money is needed to
  run them. Except for resource usage charges, like Code Engine itself.

## Tutorials

- These must be written in such a way as to explain what's going on and why.
  They are meant to fully explain all of the details as if the user knows
  next to nothing. Simply having the user copy-n-paste the commands to run
  is not sufficient.
- The README must be written so that the `bin/run-tutorial` script can execute
  the desired commands to verify things work.
  - Commands that start with "$" are executed
  - Commands that start with ">" are not executed
  - Background commands that need to be executed, but are not meant to be
    done by the user, are wrapped with `<!-- cmd -->`
  - The special command `<-- clean -->` denotes the start of the clean-up
    actions. These must fully clean-up anything done during the tutorial.
    This must come at the end of your tutorial's README so that when the user
    is done, everything will return to it's normal/clean state. This will
    also be called from the bin/clean script for times when things go wrong
    and people need to start over.
- See the Thumbnail tutorial as an example.

## Samples

- These need to be as small as possible and focused just on the one task that
  they're trying to demonstrate.
- While docs are good, keep it to a minimum otherwise things will look more
  complex than they really are.
- See the helloworld sample as an example.
