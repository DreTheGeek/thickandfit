#!/usr/bin/env bash
# Blocks hardcoded secrets.
input=$(cat)
file=$(echo "$input" | jq -r '.tool_input.file_path // empty')
content=$(echo "$input" | jq -r '.tool_input.content // .tool_input.new_string // empty')
case "$file" in *.env.example|*.env.sample) exit 0 ;; esac
if echo "$content" | grep -qE '(sk-[a-zA-Z0-9]{20,}|sk_live_[a-zA-Z0-9]+|-----BEGIN (RSA |EC )?PRIVATE KEY-----)'; then
  echo "BLOCKED: hardcoded secret detected. Use environment variables. Never commit live keys." >&2
  exit 2
fi
exit 0
