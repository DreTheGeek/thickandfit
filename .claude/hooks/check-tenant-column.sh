#!/usr/bin/env bash
# Blocks CREATE TABLE without company_id or org_id. Allowlist: -- KALDR:GLOBAL
input=$(cat)
file=$(echo "$input" | jq -r '.tool_input.file_path // empty')
content=$(echo "$input" | jq -r '.tool_input.content // .tool_input.new_string // empty')
case "$file" in *.sql|*migrations*|*migration*) ;; *) exit 0 ;; esac
echo "$content" | awk '
  /CREATE TABLE/ { intable=1; buf=""; global=0 }
  /KALDR:GLOBAL/ { global=1 }
  intable { buf=buf $0 "\n" }
  intable && /\);/ {
    intable=0
    if (!global && buf !~ /company_id/ && buf !~ /org_id/) { print "MISSING_TENANT" }
  }
' | grep -q MISSING_TENANT
if [ $? -eq 0 ]; then
  echo "BLOCKED: a CREATE TABLE has no company_id or org_id. Every table is tenant-scoped with RLS. If global lookup, add -- KALDR:GLOBAL on the CREATE TABLE line." >&2
  exit 2
fi
exit 0
