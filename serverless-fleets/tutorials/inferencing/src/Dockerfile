FROM nvcr.io/nvidia/cuda:12.9.0-runtime-ubuntu24.04

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    git \
    python3 \
    python3-pip \
    python3-venv \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

ENV VIRTUAL_ENV=/opt/env
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

RUN python3 -m venv $VIRTUAL_ENV

RUN pip install --no-cache-dir --upgrade pip

COPY app.py requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# CMD ["python", "app.py"]
