#!/usr/bin/env bash

if [ -z "$PLAYWRIGHT_BROWSERS_PATH" ]; then
  echo "PLAYWRIGHT_BROWSERS_PATH environment variable is not set. Please set it to the desired Playwright folder path."
  exit 1
fi

mkdir -p "$PLAYWRIGHT_BROWSERS_PATH" && chown -R $_CONTAINER_USER:$_CONTAINER_USER "$PLAYWRIGHT_BROWSERS_PATH"
