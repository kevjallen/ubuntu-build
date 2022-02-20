ARG UBUNTU_VERSION=20.04
FROM ubuntu:${UBUNTU_VERSION} as common

ENV HOME /root

RUN apt-get update && apt-get install -y curl git

ARG ASDF_REPO=https://github.com/asdf-vm/asdf.git
ARG ASDF_VERSION=v0.9.0

RUN git clone ${ASDF_REPO} $HOME/.asdf --branch ${ASDF_VERSION}
ENV ASDF_SCRIPT='$HOME/.asdf/asdf.sh'


FROM common as full

WORKDIR $HOME
COPY .tool-versions .

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
RUN /bin/bash -c "source ${ASDF_SCRIPT} && asdf plugin add python"
RUN /bin/bash -c "source ${ASDF_SCRIPT} && asdf install python"

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
RUN /bin/bash -c "source ${ASDF_SCRIPT} && asdf plugin add ruby"
RUN /bin/bash -c "source ${ASDF_SCRIPT} && asdf install ruby"

RUN /bin/bash -c "source ${ASDF_SCRIPT} && asdf plugin add golang"
RUN /bin/bash -c "source ${ASDF_SCRIPT} && asdf install golang"

RUN /bin/bash -c "source ${ASDF_SCRIPT} && asdf plugin add nodejs"
RUN /bin/bash -c "source ${ASDF_SCRIPT} && asdf install nodejs"

CMD /bin/bash -c "source ${ASDF_SCRIPT} && /bin/bash"


FROM common as slim

WORKDIR $HOME
COPY --from=full $HOME/.asdf .asdf
COPY --from=full $HOME/.tool-versions .tool-versions

RUN apt-get update && apt-get install -y libyaml-0-2

CMD /bin/bash -c "source ${ASDF_SCRIPT} && /bin/bash"
