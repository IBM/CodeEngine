# Contributing Guidelines

Welcome to CodeEngine Samples, we are glad you want to contribute to the project!
This document contains general guidelines for submitting contributions.

## Contributing prerequisites (CLA/DCO)

The project does not yet define a Contributor License Agreement or
[Developer Certificate of Origin (DCO)](https://wiki.linuxfoundation.org/dco).
By submitting pull requests submitters acknowledge they grant the
[Apache License v2](./LICENSE) to the code and that they are eligible to grant this license for all commits submitted in their pull requests.

## Getting Started

All contributors must abide by our [Code of Conduct](/CODE_OF_CONDUCT.md).

This repository contains multiple workloads samples that can be deploy into IBM Cloud Code Engine.


## Writing Pull Requests

Contributions can be submitted by creating a pull request on Github.
We recommend you do the following to ensure the maintainers can collaborate on your contribution:

- Fork the project into your personal Github account
- Create a new feature branch for your contribution
- Make your changes
- Open a PR with a clear description

Contributors must include a Signed-off-by line in their commit message, to avoid
having PRs blocked. Always include an email address that matches the
commit author. For example:

```
feat: this is my commit message

Signed-off-by: Author Name <authoremail@example.com>
```

You can also do this automatically with `git`, by using the -s flag:

```
$ git commit -s -m 'This is my commit message'
```

## Code review process

Once your pull request is submitted, a Project maintainer should be assigned to review your changes.

The code review should cover:

- Ensure all related tests are passing.
- Ensure the code style is compliant with the [coding conventions](https://github.com/kubernetes/community/blob/master/contributors/guide/coding-conventions.md)
- Ensure the code is properly documented, e.g. enough comments where needed.
- Ensure the code is adding the necessary test cases if needed.

Contributors are expected to respond to feedback from reviewers in a constructive manner.
Reviewers are expected to respond to new submissions in a timely fashion, with clear language if changes are requested.

Once the pull request is approved, it will get merged.