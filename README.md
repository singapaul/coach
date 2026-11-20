# coach

AI Strength Coach. The architecture and build plan is in `docs/AI Strength Coach — Architecture & Build Plan.md`; vocabulary is in `GLOSSARY.md` and decisions in `docs/adr/`.

## Layout

| Path | Package | What it is |
| --- | --- | --- |
| `apps/mobile` | `@coach/mobile` | Expo app (TypeScript), built with EAS as an Android development build |
| `supabase/` | | Supabase project: `config.toml`, `migrations/`, `functions/` |
| `supabase/functions/_shared/contract` | `@coach/contract` | Published-object contract: Zod schemas and types (ADR 0003) |
| `supabase/types` | `@coach/db-types` | Database types generated from the local schema |
| `tests` | `@coach/api-tests` | Vitest + supabase-js tests against the local stack |

## Prerequisites

Node 22, pnpm 9, the Supabase CLI (v2), and Docker (Docker Desktop or colima). For phone builds, the EAS CLI (`npx eas-cli`) and an Expo account.

## From a fresh clone

```sh
pnpm install
pnpm db:start      # supabase start: pulls images, starts the stack, applies migrations
pnpm test          # API tests against the local stack
pnpm typecheck     # every workspace package
```

Other commands:

```sh
pnpm db:reset      # drop the local database, re-apply every migration, then run supabase/seeds/*.sql
pnpm db:types      # regenerate supabase/types/database.ts from the local schema
pnpm db:stop       # stop the stack
supabase migration new <name>   # new file in supabase/migrations/
```

After changing the schema, run `pnpm db:reset && pnpm db:types` and commit the regenerated `supabase/types/database.ts`.

### Seed data

`supabase/seeds/*.sql` run in file-name order after the migrations, on every `db reset`. Each file is safe to run again.

- `01_free_exercise_db.sql`: the whole of [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (Unlicense) at a pinned commit. It's generated, so don't edit it by hand. To move to a newer commit, change `COMMIT` and `SHA256` in `scripts/generate-exercise-seed.mjs`, then run `node scripts/generate-exercise-seed.mjs`. The seed itself never touches the network.
- `02_coach_shortlist.sql`: the hand-tagged shortlist of exercises the coach may use (ADR 0004). It's the only place that sets tags on seeded exercises: add, change or remove a line there.

- `03_starting_block.sql`: the local test user, **`lifter@coach.local` / `coach-local-lifter`** (Europe/London), and their starting Push/Pull/Legs block. The block starts on the Monday of the current training week at seed time, and only week 1 exists: its sessions and calibration prescribed sets with no target loads (ADR 0002). On the hosted project the block is created for the real account by a one-off script instead.

Which exercises the coach may use is defined once, by the `coach_eligible_exercises()` database function.

### Published objects

Clients read published objects over RPC (ADR 0001); their Zod schemas are in the contract package.

- `today_plan()`: today's session in the lifter's time zone, with its exercises, prescribed sets and logged sets, or `session: null` with `reason` `no_active_block` or `no_session_today`. `today_plan_at(p_at)` returns the same object as if "now" were `p_at`; the tests use it to pin the clock, and clients call `today_plan()`.

Training weeks run Monday to Sunday in the profile's time zone: `training_week_start(date)` and `lifter_local_date(timestamptz)` are the database helpers for that.

### Running a second stack beside the first

The defaults in `supabase/config.toml` are the standard Supabase ports (54321 and up) and project id `coach`. The Supabase CLI reads any config key from a `SUPABASE_<SECTION>_<KEY>` env var, so another checkout can run its own stack without editing committed files:

```sh
eval "$(scripts/stack-env.sh coach-2 100)"   # project coach-2 on ports 54421 and up
pnpm db:start && pnpm test
```

Every `supabase` command and the tests follow those variables for as long as they are set in that shell. The tests find the stack with `supabase status -o json`, or from `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` if all three are set.

## The phone app

The app is an Expo **development build**, not Expo Go. Build and install it once; after that, JavaScript changes load from the Metro dev server on your Mac.

1. Point the app at your local stack. Create `apps/mobile/.env.local` (gitignored):

   ```sh
   # 127.0.0.1 would be the phone itself: use your Mac's LAN IP.
   EXPO_PUBLIC_SUPABASE_URL=http://192.168.1.20:54321
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from `supabase status -o env`>
   ```

   The phone and Mac must be on the same network.

2. Build the development APK in EAS (first time only, or after adding a native module):

   ```sh
   cd apps/mobile
   npx eas-cli login
   npx eas-cli init          # links the app to an EAS project; commits the projectId into app.json
   pnpm build:dev            # eas build --profile development --platform android
   ```

   Install the APK from the link EAS prints (open it on the phone, or `adb install`).

3. Start Metro and open the app on the phone:

   ```sh
   cd apps/mobile
   pnpm start                # expo start --dev-client
   ```

   Open Coach on the phone and pick the dev server, or scan the QR code.

Sign up with an email and password (email confirmation is off locally), and the app creates your profile with the phone's time zone. To see a seeded plan, log in as `lifter@coach.local` / `coach-local-lifter` instead. The login is saved on the phone (AsyncStorage) and survives an app restart until you log out.

## Hosted project

Migrations are applied to the hosted project by hand until CI exists: `supabase link --project-ref <ref>` then `supabase db push`. Also remove `graphql_public` from the hosted project's exposed schemas (Settings > API), since GraphQL stays off (ADR 0001).
