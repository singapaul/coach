#!/usr/bin/env sh
# Prints exports that run a second local Supabase stack beside the default one,
# without editing supabase/config.toml. The Supabase CLI reads any config key
# from a SUPABASE_<SECTION>_<KEY> env var.
#
#   eval "$(scripts/stack-env.sh coach-2 100)"   # project coach-2, ports 54421...
#   supabase start && pnpm test
#
# Every supabase command (start, stop, status, db reset, gen types) and the
# tests then use that stack while the variables are set in the shell.
set -eu

project_id="${1:?usage: stack-env.sh <project-id> <port-offset>}"
offset="${2:?usage: stack-env.sh <project-id> <port-offset>}"

echo "export SUPABASE_PROJECT_ID=$project_id"
echo "export SUPABASE_API_PORT=$((54321 + offset))"
echo "export SUPABASE_DB_PORT=$((54322 + offset))"
echo "export SUPABASE_DB_SHADOW_PORT=$((54320 + offset))"
echo "export SUPABASE_DB_POOLER_PORT=$((54329 + offset))"
echo "export SUPABASE_STUDIO_PORT=$((54323 + offset))"
echo "export SUPABASE_INBUCKET_PORT=$((54324 + offset))"
echo "export SUPABASE_ANALYTICS_PORT=$((54327 + offset))"
echo "export SUPABASE_EDGE_RUNTIME_INSPECTOR_PORT=$((8083 + offset))"
