#!/usr/bin/env bash
# Copy this case's fixture into the run's empty workspace.
set -euo pipefail
cp -R "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/fixture/." .
