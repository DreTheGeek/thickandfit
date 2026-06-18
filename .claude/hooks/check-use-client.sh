#!/usr/bin/env bash
# Flags interactive components missing "use client" (Next.js App Router).
input=$(cat)
file=$(echo "$input" | jq -r '.tool_input.file_path // empty')
content=$(echo "$input" | jq -r '.tool_input.content // .tool_input.new_string // empty')
case "$file" in *.tsx|*.jsx) ;; *) exit 0 ;; esac
if echo "$content" | grep -qE '(useState|useEffect|useReducer|onClick|onChange|onSubmit)'; then
  first_line=$(echo "$content" | head -1 | tr -d '[:space:]')
  if [ "$first_line" != '"useclient"' ] && [ "$first_line" != "'useclient'" ]; then
    echo "BLOCKED: interactive component uses hooks/handlers without \"use client\" as the first line." >&2
    exit 2
  fi
fi
exit 0
