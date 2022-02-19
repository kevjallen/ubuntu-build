export default class ImageStageTarget {
  public name: string;

  public repoName: string;

  public isDefault?: boolean;

  constructor(name: string, repoName: string, isDefault: boolean) {
    this.name = name;
    this.repoName = repoName;
    this.isDefault = isDefault;
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

  getBuildCommand(cacheFrom?: string[]) {
    let cacheFromArgs = '';

    if (cacheFrom) {
      cacheFromArgs = `--cache-from ${cacheFrom.join(' --cache-from ')}`;
    }

    return `docker build -t ${this.getBuildTag()} ${cacheFromArgs}`
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
