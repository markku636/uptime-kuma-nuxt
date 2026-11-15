#!/bin/sh
set -eu
# Schema changes are performed by a separate migration Job/service.
exec "$@"
