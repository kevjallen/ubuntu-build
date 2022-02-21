#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ImagePipelineStack } from '../lib/image-pipeline-stack';

const app = new cdk.App();

const initAsdf = '. /root/.asdf/asdf.sh';

new ImagePipelineStack(app, 'UbuntuBuildPipeline', {
  gitHubTokenSecretName: 'github-token',
  sourceRepo: 'kevjallen/ubuntu-build',

  buildProjectName: 'ubuntu-build',
  ecrRepositoryName: 'ubuntu-build',
  buildStageTargets: ['full', 'slim'],
  imageBuildArgs:['BUILDKIT_INLINE_CACHE=1'],
  imageTests: [
    {
      testId: 'rails_install',
      command: `${initAsdf} && gem install rails`,
      shell: '/bin/bash',
    },
    {
      testId: 'flask_install',
      command: `${initAsdf} && pip install flask`,
      shell: '/bin/bash',
    },
  ],
  webhookTrunkBranch: 'master',
});
