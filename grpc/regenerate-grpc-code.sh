#!/bin/bash

set -euo pipefail

BASEDIR="$(dirname "$0")"

if ! hash protoc >/dev/null 2>&1; then
  echo "[ERROR] protoc compiler plugin is not installed, bailing out."
  echo "[INFO]  refer to https://grpc.io/docs/languages/go/quickstart/#prerequisites for installation guidelines."
  echo
  exit 1
fi

if ! hash protoc-gen-go >/dev/null 2>&1; then
  echo "[ERROR] protoc-gen-go plugin is not installed, bailing out."
  echo "[INFO]  refer to https://grpc.io/docs/languages/go/quickstart/#prerequisites for installation guidelines."
  echo "[INFO]  ensure your GOPATH is in your PATH".
  exit 1
fi


echo "[INFO] Recompiling .proto file, this will regenerate the *.pb.go files."
protoc --go_out=. --go_opt=paths=source_relative \
    --go-grpc_out=. --go-grpc_opt=paths=source_relative \
    ${BASEDIR}/ecommerce/ecommerce.proto
