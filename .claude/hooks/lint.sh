#!/usr/bin/env bash
# PostToolUse: ESLint on code writes (NOT Biome). Flags.
input=$(cat)
file=$(echo "$input" | jq -r '.tool_input.file_path // empty')
case "$file" in *.ts|*.tsx|*.js|*.jsx) ;; *) exit 0 ;; esac
npx eslint "$file" 2>&1 | head -20
exit 0
