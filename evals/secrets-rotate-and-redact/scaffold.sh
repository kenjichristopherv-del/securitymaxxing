#!/usr/bin/env bash
# Copy the fixture into the run's empty workspace and commit it, so the leaked
# credentials are in git history (rotation is mandatory, deletion is not enough).
set -euo pipefail
cp -R "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/fixture/." .
g() { git -c user.name=dev -c user.email=dev@example.invalid -c commit.gpgsign=false "$@"; }
git init -q -b main .
g add .
g commit -q -m "Add billing config"
