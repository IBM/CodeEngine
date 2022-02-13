FROM icr.io/codeengine/python:latest


WORKDIR cos2cos
ADD templates ./templates/
ADD *.py ./
RUN ls -lR .
RUN /usr/local/bin/python -m pip install --upgrade pip
RUN /usr/local/bin/python -m pip install -e .
RUN which c2c

CMD ["/usr/local/bin/c2c","-i","https://iam.cloud.ibm.com/identity/token"]
