#!/usr/bin/env bash
# Blocks demo/mock/seed data INSERTs in migrations (lookup rows allowed).
input=$(cat)
file=$(echo "$input" | jq -r '.tool_input.file_path // empty')
content=$(echo "$input" | jq -r '.tool_input.content // .tool_input.new_string // empty')
case "$file" in *.sql|*migrations*|*migration*) ;; *) exit 0 ;; esac
if echo "$content" | grep -iqE "INSERT INTO.*(test|demo|sample|mock|john doe|jane doe|lorem|example@)"; then
  echo "BLOCKED: demo/mock/seed data in a migration. Only required system lookup rows ship. No demo data." >&2
  exit 2
fi
exit 0
