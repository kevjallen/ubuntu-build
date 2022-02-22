export interface BuildCommandOptions {
  buildArgs?: string[]
  cacheFrom?: string[]
}

export default class BuildStageTarget {
  public name: string;

  public repoName: string;

  private isDefault: boolean;

  constructor(name: string, repoName: string) {
    this.name = name;
    this.repoName = repoName;
    this.isDefault = (name === 'default');
  }

  getBuildTag() {
    const buildTag = `${this.repoName}:$CODEBUILD_RESOLVED_SOURCE_VERSION`;
    return this.isDefault ? buildTag : `${buildTag}-${this.name}`;
  }

  getLatestTag() {
    return this.isDefault ? `${this.repoName}:latest` : `${this.repoName}:${this.name}`;
  }

  getPublishTag() {
    const publishTag = `${this.repoName}:$VERSION`;
    return this.isDefault ? publishTag : `${publishTag}-${this.name}`;
  }

  getBuildCommand(options?: BuildCommandOptions) {
    let commandArgs: string[] = [];

    if (options?.buildArgs) {
      commandArgs = commandArgs.concat(
        options.buildArgs.map((arg) => `--build-arg ${arg}`),
      );
    }
    if (options?.cacheFrom) {
      commandArgs = commandArgs.concat(
        options.cacheFrom.map((image) => `--cache-from ${image}`),
      );
    }

    return `docker build -t ${this.getBuildTag()} ${commandArgs.join(' ')}`
      + ` ${this.isDefault ? '.' : `--target ${this.name} .`}`;
  }

  getPullVersionTagCommand() {
    return `docker pull ${this.getPublishTag()}`;
  }

  getPullLatestTagCommand() {
    return `docker pull ${this.getLatestTag()}`;
  }

  getPublishVersionTagCommand() {
    return `docker image tag ${this.getBuildTag()} ${this.getPublishTag()}`
      + ` && docker image push ${this.getPublishTag()}`;
  }

  getPublishLatestTagCommand() {
    return `docker image tag ${this.getBuildTag()} ${this.getLatestTag()}`
      + ` && docker image push ${this.getLatestTag()}`;
  }
}
