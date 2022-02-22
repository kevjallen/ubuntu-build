import { Construct } from 'constructs';
import { Stack, StackProps } from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import ImageBuildProject, {
  ImageTestProps, ImageBuildProjectProps,
} from './image-build-project';

export interface ImagePipelineStackProps extends StackProps {
  gitHubTokenSecretName: string
  sourceRepo: string

  buildProjectName?: string
  buildStageTargets?: string[]
  ecrRepositoryName?: string
  imageBuildArgs?: string[]
  imageTests?: ImageTestProps[]
  securityProjectName?: string
  webhookTrunkBranch?: string
}

export class ImagePipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: ImagePipelineStackProps) {
    super(scope, id, props);

    const ecrRepository = new Repository(this, 'Repository', {
      repositoryName: props.ecrRepositoryName,
      imageScanOnPush: true,
    });

    const gitHubToken = Secret.fromSecretNameV2(
      this,
      'GithubToken',
      props.gitHubTokenSecretName,
    );

    const commonImageBuildProjectProps: ImageBuildProjectProps = {
      buildStageTargets: props.buildStageTargets,
      imageBuildArgs: props.imageBuildArgs,
      imageTests: props.imageTests,
      sourceRepo: props.sourceRepo,

      ecrRepository,
      gitHubToken,
    };

    const main = new ImageBuildProject(this, 'MainBuild', {
      ...commonImageBuildProjectProps,
      buildProjectName: props.buildProjectName,
      webhookFilters: [
        codebuild.FilterGroup.inEventOf(codebuild.EventAction.PUSH)
          .andBranchIs(props.webhookTrunkBranch || 'master')
          .andCommitMessageIsNot('^security:.*'),
        codebuild.FilterGroup.inEventOf(
          codebuild.EventAction.PULL_REQUEST_CREATED,
          codebuild.EventAction.PULL_REQUEST_REOPENED,
          codebuild.EventAction.PULL_REQUEST_UPDATED,
        ),
      ],
    });
    ecrRepository.grantPullPush(main.buildProject);
    gitHubToken.grantRead(main.buildProject);

    const security = new ImageBuildProject(this, 'SecurityBuild', {
      ...commonImageBuildProjectProps,
      buildProjectName: props.securityProjectName,
      cachingEnabled: false,
      webhookFilters: [
        codebuild.FilterGroup.inEventOf(codebuild.EventAction.PUSH)
          .andBranchIs(props.webhookTrunkBranch || 'master')
          .andCommitMessageIs('^security:.*'),
      ],
    });
    ecrRepository.grantPullPush(security.buildProject);
    gitHubToken.grantRead(security.buildProject);
  }
}
