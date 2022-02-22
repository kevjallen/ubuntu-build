import { Construct } from 'constructs';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import { ISecret } from 'aws-cdk-lib/aws-secretsmanager';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import BuildStageTarget from './build-stage-target';

export interface ImageTestProps {
  command: string
  testId: string

  shell?: string
  stageTarget?: string
}

export interface ImageBuildProjectProps {
  ecrRepository: Repository
  gitHubToken: ISecret
  sourceRepo: string

  buildProjectName?: string
  buildStageTargets?: string[]
  cachingEnabled?: boolean
  imageBuildArgs?: string[]
  imageTests?: ImageTestProps[]
  webhookFilters?: codebuild.FilterGroup[]
}

export default class ImageBuildProject extends Construct {
  public buildProject: codebuild.Project;

  constructor(scope: Construct, id: string, props: ImageBuildProjectProps) {
    super(scope, id);

    const [sourceOwner, sourceRepo] = props.sourceRepo.split('/');

    const publishRepo = props.ecrRepository.repositoryUri;
    const stageTargets = (props.buildStageTargets || []).concat('default').map(
      (target) => new BuildStageTarget(target, publishRepo),
    );

    const buildTags = stageTargets.map((target) => target.getBuildTag());
    const latestTags = stageTargets.map((target) => target.getLatestTag());

    this.buildProject = new codebuild.Project(this, 'Project', {
      projectName: props.buildProjectName,
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        env: {
          'secrets-manager': {
            GITHUB_TOKEN: `${props.gitHubToken.secretArn}:GITHUB_TOKEN`,
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
              ...(props.cachingEnabled === false ? [] : stageTargets.map(
                (target) => `${target.getPullLatestTagCommand()} || true`,
              )),
            ],
          },
          build: {
            commands: [
              // build image(s)
              ...stageTargets.map((target) => target.getBuildCommand({
                buildArgs: props.imageBuildArgs,
                cacheFrom: props.cachingEnabled === false
                  ? [] : [...buildTags, ...latestTags],
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
        webhook: !!props.webhookFilters,
        webhookFilters: props.webhookFilters,
      }),
    });
  }
}
