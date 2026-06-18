#!/usr/bin/env bash
# Blocks bcrypt for API key hashing. API keys use SHA-256.
input=$(cat)
content=$(echo "$input" | jq -r '.tool_input.content // .tool_input.new_string // empty')
if echo "$content" | grep -iqE 'bcrypt' && echo "$content" | grep -iqE 'api[_-]?key|key_hash'; then
  echo "BLOCKED: bcrypt in API key context. bcrypt is non-deterministic so key lookup never matches. Use SHA-256 hex digest + key_prefix indexed lookup. (bcrypt is correct for user passwords.)" >&2
  exit 2
fi
exit 0
