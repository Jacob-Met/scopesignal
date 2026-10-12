#!/bin/sh
set -eu
CDPATH=
export CDPATH
cd -- "$(dirname -- "$0")/app"
exec node scripts/serve.mjs
