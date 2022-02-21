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
    const commandArgs: string[] = [];

    if (options?.buildArgs) {
      commandArgs.concat(options.buildArgs.map((arg) => `--build-arg ${arg}`));
    }

    if (options?.cacheFrom) {
      commandArgs.concat(options.cacheFrom.map((image) => `--cache-from ${image}`));
    }

    return `docker build -t ${this.getBuildTag()} ${commandArgs.join(' ')}`
      + ` ${this.isDefault ? '.' : `--target ${this.name} .`}`;
  }

  getPullLatestTagCommand() {
    return `docker pull ${this.getLatestTag()}`;
  }

  private getPublishVersionTagCommand() {
    return `docker image tag ${this.getBuildTag()} ${this.getPublishTag()}`
      + ` && docker image push ${this.getPublishTag()}`;
  }

  private getPublishLatestTagCommand() {
    return `docker image tag ${this.getBuildTag()} ${this.getLatestTag()}`
      + ` && docker image push ${this.getLatestTag()}`;
  }

  getPublishTagCommands() {
    return [this.getPublishVersionTagCommand(), this.getPublishLatestTagCommand()];
  }
}
