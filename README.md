# Ubuntu Build Image

This repository creates an Ubuntu image with [asdf-vm](https://asdf-vm.com/) installed.

Do not run your app with this. It is intended for general use with CI platforms.

An AWS CDK (TypeScript) application is included that deploys the images to ECR.

The deployments make use of layer caching extensively by default.

Redeploy without caching occasionally for security updates.
