#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
npm ci
npm test
npm run build
printf 'Web release built in dist/ and server-dist/. See deploy/README.md for installation.\n'
