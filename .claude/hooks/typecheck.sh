#!/usr/bin/env bash
# PostToolUse: typecheck on .ts/.tsx writes. Flags, does not hard-block.
input=$(cat)
file=$(echo "$input" | jq -r '.tool_input.file_path // empty')
case "$file" in *.ts|*.tsx) ;; *) exit 0 ;; esac
pnpm tsc --noEmit 2>&1 | head -20
exit 0
