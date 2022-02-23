ARG UBUNTU_VERSION=20.04
FROM ubuntu:${UBUNTU_VERSION} as base
ENV HOME /root

ENV COMMON_TOOLS build-essential curl git

RUN apt-get update && apt-get install -y ${COMMON_TOOLS}

ARG ASDF_REPO=https://github.com/asdf-vm/asdf.git
ARG ASDF_VERSION=v0.9.0

RUN git clone ${ASDF_REPO} $HOME/.asdf --branch ${ASDF_VERSION}
ENV ASDF_SCRIPT='$HOME/.asdf/asdf.sh'

WORKDIR $HOME
CMD /bin/bash -c ". ${ASDF_SCRIPT} && /bin/bash"


FROM base as golang

COPY tool-versions/golang .tool-versions
RUN /bin/bash -c ". ${ASDF_SCRIPT} && asdf plugin add golang && asdf install golang"


FROM base as nodejs

COPY tool-versions/nodejs .tool-versions
RUN /bin/bash -c ". ${ASDF_SCRIPT} && asdf plugin add nodejs && asdf install nodejs"


FROM base AS python

ENV PYTHON_BUILD_DEPS \
  make \
  build-essential \
  libssl-dev \
  zlib1g-dev \
  libbz2-dev \
  libreadline-dev \
  libsqlite3-dev \
  wget \
  curl \
  llvm \
  libncursesw5-dev \
  xz-utils \
  tk-dev \
  libxml2-dev \
  libxmlsec1-dev \
  libffi-dev \
  liblzma-dev

ENV TZ=America/New_York
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y ${PYTHON_BUILD_DEPS}

COPY tool-versions/python .tool-versions
RUN /bin/bash -c ". ${ASDF_SCRIPT} && asdf plugin add python && asdf install python"


FROM base AS ruby

ENV RUBY_BUILD_DEPS \
  autoconf \
  bison \
  build-essential \
  libtool \
  libssl-dev \
  libyaml-dev \
  libreadline6-dev \
  zlib1g-dev \
  libncurses5-dev \
  libffi-dev \
  libgdbm6 \
  libgdbm-dev \
  libdb-dev

RUN apt-get update && apt-get install -y ${RUBY_BUILD_DEPS}

COPY tool-versions/ruby .tool-versions
RUN /bin/bash -c ". ${ASDF_SCRIPT} && asdf plugin add ruby && asdf install ruby"


FROM base AS full

ENV RUNTIME_DEPS libyaml-0-2

RUN apt-get update && apt-get install -y ${RUNTIME_DEPS}

COPY --from=golang $HOME/.asdf/installs/golang .asdf/installs/golang
COPY --from=golang $HOME/.asdf/plugins/golang .asdf/plugins/golang

COPY --from=nodejs $HOME/.asdf/installs/nodejs .asdf/installs/nodejs
COPY --from=nodejs $HOME/.asdf/plugins/nodejs .asdf/plugins/nodejs

COPY --from=python $HOME/.asdf/installs/python .asdf/installs/python
COPY --from=python $HOME/.asdf/plugins/python .asdf/plugins/python

COPY --from=ruby $HOME/.asdf/installs/ruby .asdf/installs/ruby
COPY --from=ruby $HOME/.asdf/plugins/ruby .asdf/plugins/ruby

RUN /bin/bash -c ". ${ASDF_SCRIPT} && asdf reshim"

RUN TOOL_VERSIONS_STAGING=$(mktemp -d)
COPY tool-versions "$TOOL_VERSIONS_STAGING"

RUN touch .tool-versions \
  && for file in "$TOOL_VERSIONS_STAGING"; do cat "$file" >> .tool-versions; done
