#!/usr/bin/env bash
# Blocks float/numeric/decimal columns with money-like names. Money = integer cents (BIGINT _cents).
input=$(cat)
file=$(echo "$input" | jq -r '.tool_input.file_path // empty')
content=$(echo "$input" | jq -r '.tool_input.content // .tool_input.new_string // empty')
case "$file" in *.sql|*migrations*|*migration*) ;; *) exit 0 ;; esac
if echo "$content" | grep -iqE '(price|amount|cost|total|fee|balance|salary|rate|revenue|charge)[a-z_]*\s+(numeric|decimal|float|real|double)'; then
  echo "BLOCKED: money column uses float/numeric/decimal. Money is integer cents. Use BIGINT with a _cents suffix (e.g. price_cents BIGINT)." >&2
  exit 2
fi
exit 0
