#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ImagePipelineStack } from '../lib/image-pipeline-stack';

const app = new cdk.App();

const imageCommandPrefix = '/bin/bash -c source /root/.asdf/asdf.sh &&';

new ImagePipelineStack(app, 'UbuntuBuildPipeline', {
  gitHubTokenSecretName: 'github-token',
  sourceRepo: 'kevjallen/ubuntu-build',

  buildProjectName: 'ubuntu-build',
  ecrRepositoryName: 'ubuntu-build',
  imageStageTargets: ['full', 'slim'],
  imageTests: [
    { command: `${imageCommandPrefix} gem install rails` },
  ],
  webhookTrunkBranch: 'master',
});
