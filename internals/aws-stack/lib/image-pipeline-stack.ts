import { Construct } from 'constructs';
import { Stack, StackProps } from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import ImageStageTarget from './image-stage-target';

export interface ImageTestProps {
  command: string

  imageStage?: string
  shell?: string
}

export interface ImagePipelineStackProps extends StackProps {
  gitHubTokenSecretName: string
  sourceRepo: string

  buildProjectName?: string
  ecrRepositoryName?: string
  imageStageTargets?: string[]
  imageTests?: ImageTestProps[]
  webhookTrunkBranch?: string
}

export class ImagePipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: ImagePipelineStackProps) {
    super(scope, id, props);

    const [sourceOwner, sourceRepo] = props.sourceRepo.split('/');

    const ecrRepository = new Repository(this, 'Repository', {
      repositoryName: props.ecrRepositoryName,
      imageScanOnPush: true,
    });

    const githubToken = Secret.fromSecretNameV2(
      this,
      'GithubToken',
      props.gitHubTokenSecretName,
    );

    const publishRepo = ecrRepository.repositoryUri;

    const stageTargets = (props.imageStageTargets || []).concat('latest').map(
      (target) => new ImageStageTarget(target, publishRepo),
    );

    const buildTags = stageTargets.map((target) => target.getBuildTag());
    const latestTags = stageTargets.map((target) => target.getLatestTag());

    const testCommands = (props.imageTests || []).map(
      (test) => `docker run '${
        (stageTargets.find((target) => target.name === test.imageStage)
          || new ImageStageTarget('latest', publishRepo)
        ).getBuildTag()} ${test.shell || '/bin/sh'} -c '${test.command}'`,
    );

    const codebuildProject = new codebuild.Project(this, 'Project', {
      projectName: props.buildProjectName,
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        env: {
          'secrets-manager': {
            GITHUB_TOKEN: `${githubToken.secretArn}:GITHUB_TOKEN`,
          },
        },
        phases: {
          pre_build: {
            commands: [
              'aws ecr get-login-password --region $AWS_DEFAULT_REGION'
                + ` | docker login -u AWS --password-stdin ${publishRepo}`,
              ...stageTargets
                .map((target) => `${target.getPullLatestTagCommand()} || true`),
            ],
          },
          build: {
            commands: [
              ...stageTargets
                .map((target) => target.getBuildCommand([...buildTags, ...latestTags])),
              ...testCommands,
              'npx semantic-release && VERSION=$(git tag --points-at)',
            ],
          },
          post_build: {
            commands: [
              ...stageTargets
                .map((target) => target.getPublishTagCommands())
                .reduce((acc, command) => acc.concat(command), [])
                .map((command) => `if [ ! -z "$VERSION" ]; then ${command}; fi`),
            ],
          },
        },
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
        privileged: true,
      },
      source: codebuild.Source.gitHub({
        owner: sourceOwner,
        repo: sourceRepo,
        webhook: !!props.webhookTrunkBranch,
        webhookFilters: [
          codebuild.FilterGroup.inEventOf(codebuild.EventAction.PUSH)
            .andBranchIs(props.webhookTrunkBranch || 'master'),
          codebuild.FilterGroup.inEventOf(codebuild.EventAction.PULL_REQUEST_CREATED),
          codebuild.FilterGroup.inEventOf(codebuild.EventAction.PULL_REQUEST_REOPENED),
          codebuild.FilterGroup.inEventOf(codebuild.EventAction.PULL_REQUEST_UPDATED),
        ],
      }),
    });

    ecrRepository.grantPullPush(codebuildProject);
    githubToken.grantRead(codebuildProject);
  }
}
