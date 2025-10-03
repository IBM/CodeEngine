FROM python:3.11-slim-bookworm

ENV GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=no"

RUN apt-get update \
    && apt-get clean

WORKDIR /app

COPY simulate.py /app/simulate.py
COPY requirements.txt /app/requirements.txt

RUN python3 -m ensurepip && pip install --no-cache-dir -r /app/requirements.txt

# Reset the entrypoint
ENTRYPOINT []

CMD ["python3", "simulate.py"]

