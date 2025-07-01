FROM ubuntu:latest

ENV GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=no"

RUN apt update \
    && apt upgrade -y \
    && apt install -y \
      python3 \
      python3-numpy \
      python3-scipy \
      python3-pip \
      openmpi-bin \
      openmpi-common \
      openmpi-doc \
      git \
      libopenmpi-dev \
      python3-mpi4py

RUN /bin/true \
&& pip install pyscf --no-cache-dir --break-system-packages \
&& pip install git+https://github.com/pyscf/mpi4pyscf --no-cache-dir --break-system-packages


WORKDIR /app

COPY pyscf_mpi.py /app/pyscf_mpi.py
COPY requirements.txt /app/requirements.txt

# Reset the entrypoint
ENTRYPOINT []

CMD ["python3", "pyscf_mpi.py"]

