#!/usr/bin/env bash
# After a migration write, confirm every new table has RLS enabled.
input=$(cat)
file=$(echo "$input" | jq -r '.tool_input.file_path // empty')
content=$(echo "$input" | jq -r '.tool_input.content // .tool_input.new_string // empty')
case "$file" in *.sql|*migrations*|*migration*) ;; *) exit 0 ;; esac
tables=$(echo "$content" | grep -ioE 'CREATE TABLE (IF NOT EXISTS )?[a-z_]+' | sed -E 's/CREATE TABLE (IF NOT EXISTS )?//I')
missing=""
for t in $tables; do
  if ! echo "$content" | grep -iqE "ALTER TABLE $t ENABLE ROW LEVEL SECURITY"; then
    if ! echo "$content" | grep -iqE "CREATE TABLE.*$t.*KALDR:GLOBAL"; then missing="$missing $t"; fi
  fi
done
if [ -n "$missing" ]; then
  echo "BLOCKED: tables created without RLS enabled:$missing. Add ALTER TABLE <t> ENABLE ROW LEVEL SECURITY and a tenant-isolation policy for each." >&2
  exit 2
fi
exit 0
