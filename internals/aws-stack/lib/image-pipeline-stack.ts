import { Construct } from 'constructs';
import { Stack, StackProps } from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import BuildStageTarget from './build-stage-target';

export interface ImageTestProps {
  testId: string
  command: string

  stageTarget?: string
  shell?: string
}

export interface ImagePipelineStackProps extends StackProps {
  gitHubTokenSecretName: string
  sourceRepo: string

  buildProjectName?: string
  ecrRepositoryName?: string
  buildStageTargets?: string[]
  imageBuildArgs?: string[]
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

    const stageTargets = (props.buildStageTargets || []).concat('default').map(
      (target) => new BuildStageTarget(target, publishRepo),
    );

    const buildTags = stageTargets.map((target) => target.getBuildTag());
    const latestTags = stageTargets.map((target) => target.getLatestTag());

    const codebuildProject = new codebuild.Project(this, 'Project', {
      projectName: props.buildProjectName,
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        env: {
          'secrets-manager': {
            GITHUB_TOKEN: `${githubToken.secretArn}:GITHUB_TOKEN`,
          },
          variables: {
            DOCKER_BUILDKIT: 1,
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
              // build image(s)
              ...stageTargets.map((target) => target.getBuildCommand({
                buildArgs: props.imageBuildArgs,
                cacheFrom: [...buildTags, ...latestTags],
              })),

              // create folders for test results and process ids
              'TEST_PIDFILE_DIR=$(mktemp -d) && TEST_RESULTS_DIR=$(mktemp -d)',

              // start test commands, sending them all to the background
              `${`${(props.imageTests || []).map((test) => `nohup docker run ${
                (stageTargets.find((target) => target.name === test.stageTarget)
                  || new BuildStageTarget('default', publishRepo)).getBuildTag()}`
                + ` ${test.shell || '/bin/sh'} -c '${test.command}'`
                + ` > $TEST_RESULTS_DIR/${test.testId} 2>&1`
                + ` & echo $! > $TEST_PIDFILE_DIR/${test.testId}`).join('; ')};`

                // bring test commands into the foreground one at a time
                + ' for file in $TEST_PIDFILE_DIR/*; do wait $(cat "$file")'
                + ' || { echo; echo ">>> TEST \'$(basename "$file")\' FAILED <<<";'
                + ' echo; cat "$TEST_RESULTS_DIR/$(basename "$file")"; exit 1; }; done'
                + ' && for file in $TEST_RESULTS_DIR/*; do echo;'
                + ' echo ">>> TEST \'$(basename "$file")\' RESULTS <<<";'
                + ' echo; cat "$file"; done;'}`,

              // run the release if all went well
              'npx semantic-release && VERSION=$(git tag --points-at)',
            ],
          },
          post_build: {
            commands: [
              ...stageTargets
                .map((target) => target.getPublishTagCommands())
                .reduce((acc, command) => acc.concat(command), [])
                .map((command) => 'if [ ! -z "$VERSION" ]'
                  + ' && [ ! -z "$CODEBUILD_WEBHOOK_TRIGGER" ];'
                  + ` then ${command}; fi`),
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
          codebuild.FilterGroup.inEventOf(
            codebuild.EventAction.PULL_REQUEST_CREATED,
            codebuild.EventAction.PULL_REQUEST_REOPENED,
            codebuild.EventAction.PULL_REQUEST_UPDATED,
          ),
        ],
      }),
    });
    ecrRepository.grantPullPush(codebuildProject);
    githubToken.grantRead(codebuildProject);
  }
}
