# Ubuntu Build Image

This repository creates an Ubuntu image with [asdf-vm](https://asdf-vm.com/) installed.

Do not run your app with this. It is intended for general use with CI platforms.

An AWS CDK (TypeScript) application is included that deploys the images to ECR.

The deployments make use of layer caching extensively by default.

Redeploy without caching occasionally for security updates.


## Usage

The version manager script is located at `/root/.asdf/asdf.sh`.

The script is not POSIX-compliant and will not work with all shells.
Bash is recommended.

It must be executed in the shell context explicitly when starting a container.
- `docker run ubuntu-build /bin/bash -c '. /root/asdf/asdf.sh && ./some-script.sh'`

The version manager makes it easy to install and manage tools like Node.js and Python.

To install tools defined in your project's `.tool-versions` file:
- `asdf install`

To install Node.js version(s) defined in your project's `.tool-versions` file:
- `asdf install nodejs`

To install a specific version of Node.js (also accepts the keyword `latest`):
- `asdf install nodejs 16.14.0`

The version manager builds Python and Ruby from source when installing them.
- The `full` image comes with all build dependencies for these tools
- Use an [included version](./.tool-versions) if you want to avoid this


## Contributions

Not accepted at this time. Fork the repository if you want.
