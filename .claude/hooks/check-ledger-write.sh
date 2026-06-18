#!/usr/bin/env bash
# Blocks any non-evaluator edit to ledger.json. Only KALDR_ROLE=evaluator may write it.
input=$(cat)
file=$(echo "$input" | jq -r '.tool_input.file_path // empty')
case "$file" in *ledger.json) ;; *) exit 0 ;; esac
if [ "$KALDR_ROLE" != "evaluator" ]; then
  echo "BLOCKED: ledger.json may only be written by the evaluator. The builder cannot mark its own work passing. Run the evaluator to verify and update the ledger." >&2
  exit 2
fi
exit 0
