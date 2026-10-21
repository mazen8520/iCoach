#!/usr/bin/env bash
# Repeats the important lines of a failed build log as one GitHub annotation. Annotations show on
# the run page (and in the API) without signing in; raw job logs do not.
# Usage: annotate-failure.sh <log file> <title> <grep -E pattern>
log="$1"
title="$2"
pattern="$3"
msg=$(grep -E -A12 "$pattern" "$log" | head -80 | tr -d '\r' | sed -e 's/%/%25/g' | awk 'BEGIN { ORS = "%0A" } { print }')
if [ -z "$msg" ]; then
  msg=$(tail -40 "$log" | tr -d '\r' | sed -e 's/%/%25/g' | awk 'BEGIN { ORS = "%0A" } { print }')
fi
echo "::error title=${title}::${msg}"
