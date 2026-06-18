#!/usr/bin/env bash

set -e

WORKSPACE_FOLDER="${WORKSPACEFOLDER:-}"

if [ -z "$WORKSPACE_FOLDER" ]; then
  echo "The 'workspaceFolder' option is not set. Please set it to the workspace folder path inside the container."
  exit 1
fi

NODE_MODULES_PATH="${WORKSPACE_FOLDER}/node_modules"

mkdir -p "$NODE_MODULES_PATH" && chown -R $_CONTAINER_USER:$_CONTAINER_USER "$NODE_MODULES_PATH"
