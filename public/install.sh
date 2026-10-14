#!/usr/bin/env sh
set -eu

PACKAGE_NAME="${INDEXFAST_CLI_PACKAGE:-indexfast}"

if ! command -v npm >/dev/null 2>&1; then
  echo "IndexFast CLI needs Node.js and npm."
  echo "Install Node.js, then run: npm install -g ${PACKAGE_NAME}"
  exit 1
fi

echo "Installing IndexFast CLI from npm package: ${PACKAGE_NAME}"
npm install -g "${PACKAGE_NAME}"

echo ""
echo "IndexFast CLI installed."
echo "You can also run commands instantly with: npx indexfast <command>"
echo ""
echo "Create an API key in https://indexfast.co/dashboard/api-keys"
echo "Then run: indexfast login --api-key idxf_..."
