#!/usr/bin/env node
// Checks that supabase/seeds/*.sql are safe to run again, against the running
// local stack (`pnpm db:seed:check`, after `pnpm db:start` or `pnpm db:reset`).
//
// 1. A seeded exercise that free-exercise-db no longer has is deleted by
//    01_free_exercise_db.sql, unless something references it.
// 2. Running every seed file twice: the second run changes nothing, in any
//    public table or in the seeded auth user (updated_at included).
//
// It writes to the local database (and tidies up after itself), so never point
// it at a hosted project. Needs psql. Follows the SUPABASE_* port overrides like
// every other supabase command (see README).

import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const seedsDir = join(repoRoot, 'supabase', 'seeds');
const SEED_LIFTER_ID = '00000000-0000-4000-8000-000000000001';

function localDbUrl() {
  const raw = execFileSync('supabase', ['status', '-o', 'json'], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const url = JSON.parse(raw.slice(raw.indexOf('{'))).DB_URL;
  if (!url) throw new Error('No DB_URL from `supabase status`: is the local stack running?');
  const host = new URL(url).hostname;
  if (host !== '127.0.0.1' && host !== 'localhost') throw new Error(`Refusing to run against ${host}: local stack only`);
  return url;
}

const dbUrl = localDbUrl();

function psql(args) {
  return execFileSync('psql', [dbUrl, '-X', '-q', '-v', 'ON_ERROR_STOP=1', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

const sql = (statement) => psql(['-At', '-c', statement]).trim();

const seedFiles = readdirSync(seedsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

function runSeeds(files = seedFiles) {
  for (const f of files) psql(['-f', join(seedsDir, f)]);
}

/** A fingerprint of every public table and the seeded auth user. */
function snapshot() {
  const tables = sql(
    "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1",
  ).split('\n');
  const result = {};
  for (const t of tables) {
    result[`public.${t}`] = sql(
      `select count(*) || ' ' || md5(coalesce(string_agg(r::text, E'\\n' order by r::text), '')) from public."${t}" r`,
    );
  }
  for (const t of ['users', 'identities']) {
    const key = t === 'users' ? 'id' : 'user_id';
    result[`auth.${t}`] = sql(
      `select count(*) || ' ' || md5(coalesce(string_agg(r::text, E'\\n' order by r::text), '')) from auth.${t} r where r.${key} = '${SEED_LIFTER_ID}'`,
    );
  }
  return result;
}

let failed = false;
function check(ok, message) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${message}`);
  if (!ok) failed = true;
}

// 1. Stale seeded exercises.
const STALE_FREE = 'Zz_Seed_Check_Removed_Upstream';
const STALE_USED = 'Zz_Seed_Check_Removed_Upstream_But_Used';
try {
  sql(
    `insert into public.exercises (id, name, source, user_id) values ('${STALE_FREE}', 'Seed check (unreferenced)', 'seed', null), ('${STALE_USED}', 'Seed check (referenced)', 'seed', null)`,
  );
  sql(`insert into public.user_exercise_prefs (user_id, exercise_id, favourite) values ('${SEED_LIFTER_ID}', '${STALE_USED}', true)`);

  runSeeds(['01_free_exercise_db.sql']);

  check(sql(`select count(*) from public.exercises where id = '${STALE_FREE}'`) === '0', 'an unreferenced seeded exercise no longer in free-exercise-db is deleted');
  check(sql(`select count(*) from public.exercises where id = '${STALE_USED}'`) === '1', 'a referenced one is kept');
} finally {
  sql(`delete from public.user_exercise_prefs where exercise_id in ('${STALE_FREE}', '${STALE_USED}')`);
  sql(`delete from public.exercises where id in ('${STALE_FREE}', '${STALE_USED}')`);
}

// 2. Idempotency.
runSeeds();
const first = snapshot();
runSeeds();
const second = snapshot();
for (const [table, fingerprint] of Object.entries(first)) {
  check(second[table] === fingerprint, `second run leaves ${table} unchanged (${fingerprint.split(' ')[0]} rows)`);
}

if (failed) {
  console.error('\nSeed check failed.');
  process.exit(1);
}
console.log(`\nSeeds are safe to run again (${seedFiles.join(', ')}).`);
