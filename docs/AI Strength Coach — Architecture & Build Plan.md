# AI Strength Coach — Architecture & Build Plan

Nov 19, 2026 · @Paul Hardman

## Overview

A personal coach that tells you what to lift, what to eat and how you're tracking, with almost no manual input. Each week you get adjusted lifting loads, a calorie and macro allowance, a meal-prep plan and a written coaching summary.

**Your only inputs:** tick off sets in the gym, step on the Renpho scale, wear your Garmin. Food is something the coach sends you, not something you log.

**Design principles**

- **Remove friction.** Anything that can sync automatically does. Prescribed sets are pre-filled so logging is one tap.
- **Code does the maths, Claude does the coaching.** Progression and calorie targets are deterministic rules. Claude writes summaries, meal plans and new splits, and handles chat.
- **One backend, many clients.** A single Supabase project serves the phone app, the frame dashboard and the Claude app.
- **No servers to manage.** Everything runs on managed or serverless services; no VPS.

## Architecture

All data lands in one Supabase project; the phone app writes to it, scheduled functions enrich it, and three surfaces read from it.

&#91;embedded content: system architecture · inputs, backend, surfaces\]

Renpho reaches the backend through Health Connect and your phone; Garmin is pulled server-side; the backend calls Claude for writing, and the frame and Claude app read the same records.

## Tech stack

Everything is TypeScript end to end, and the running cost is roughly £0 plus a few pounds a month of Claude API usage.

| Layer | Choice | Why |
| --- | --- | --- |
| Mobile app | Expo + React Native + TypeScript, built with EAS | Native access to Health Connect; one codebase |
| Health data | `react-native-health-connect` + Expo background task | Reads Renpho weight and body fat on device |
| Backend | Supabase: Postgres, Auth, Row Level Security | Managed database with login and per-user access |
| API | Supabase auto REST (PostgREST) + GraphQL (pg\_graphql) | Generated from your tables; no server to write |
| Logic | Supabase Edge Functions (TypeScript/Deno) | Progression, calories, Garmin pull, Claude calls, MCP |
| Scheduling | pg\_cron | Daily Garmin pull, Sunday weekly review |
| AI | Claude API via Anthropic TypeScript SDK, structured JSON output | Briefings, meal plans, split generation, chat |
| Recovery data | Garmin Connect Personal API | Self-serve key for your own data |
| Exercise library | free-exercise-db (public domain, 800+ exercises) | Seed data with muscles and equipment |
| Claude app access | Remote MCP server as an Edge Function | Chat with the coach in the Claude app |
| Frame | TRMNL polling an endpoint, or a web dashboard on Cloudflare Pages | Weekly briefing on a separate screen |
| Dev tooling | GitHub, Supabase CLI migrations, VS Code | Versioned schema and code |

## Data sources

Three sources feed the coach; only lifting needs your input.

| Source | How it arrives | Frequency | Your effort |
| --- | --- | --- | --- |
| Lifts | Your app posts each set to the backend | Every set | Tap ✓ or edit reps |
| Bodyweight + body fat | Renpho Health → Health Connect → your app → backend | Daily background sync | Step on the scale |
| Recovery (sleep, HRV, resting HR, activities) | Garmin Personal API, pulled by an Edge Function | Daily | None |

**Renpho.** There is no public Renpho API. Renpho writes readings to Health Connect; your app asks for read permission once (Android's standard Health Connect screen) and syncs new records. Turn on Health Connect's background-read permission so it works without opening the app.

**Garmin.** Generate a Personal API key in Garmin Connect account settings and store it as a Supabase secret. Access is pull-only, so a daily job fetches it.

**Lifts are logged in your own app.** Workout apps such as Hevy write only a session summary (type, duration, calories) to Health Connect, not sets, reps and weights, so they can't drive progressive overload. Optionally, your app writes each finished session back to Health Connect so Garmin and other apps see it.

**Not used: MyFitnessPal.** Its public API closed in 2019. Instead the coach sets your meals, and calorie adjustments come from your weight trend.

**Health Connect has no web view.** Data lives only on the phone. While developing, inspect it in the Health Connect settings screen, by logging records to your terminal, or with Google's Health Connect Toolbox app (which can also insert test records). Once synced, the Supabase dashboard is your web view.

## Programming: splits, blocks and the exercise library

You start on a 3-day push/pull/legs split; every 12 weeks, or whenever you ask, the coach proposes new splits and writes the chosen one straight into your workout section.

### Building blocks

- **Day groups** are reusable templates with a focus: push, pull, legs, upper, lower, core, full body, arms. Variations are allowed (Push A, Push B).
- **A split** is a weekly arrangement of day groups, e.g. Push · Pull · Legs, or Upper · Lower · Core.
- **A block** (mesocycle) is a split run for a set length (default 12 weeks), tied to a goal, with a lighter final week.

### Exercise library

- Seeded from free-exercise-db (public domain, 800+ exercises, JSON importable to Postgres).
- Each exercise carries primary and secondary muscles, movement pattern (horizontal push, vertical pull, squat, hinge, carry, core) and equipment.
- Your own fields: equipment available at your gym, favourites, exercises to avoid, and "similar exercise" links for swaps.
- Claude may only choose exercises from this library.

### Weekly balance check (code, not AI)

- **Sets per muscle:** primary muscle = 1 set, secondary = 0.5. Compared with a target range per muscle (roughly 10–20 hard sets a week for major muscles, adjusted by goal).
- **Movement balance:** push vs pull volume, squat vs hinge.
- **Frequency:** times per week each muscle is trained. Note: 3-day push/pull/legs hits each muscle once a week; the coach may suggest twice-weekly options later.
- Shown as a bar per muscle in the split editor; edits trigger live warnings but are never blocked.

### Generating a new split

1. **Trigger:** week 12 of a block (flagged by the Sunday job), a "New split" button, or asking in the Claude app.
2. **Context:** block history, what progressed and stalled, attendance, goal, available days.
3. **Claude returns 2–3 options as structured JSON:** days, exercises (library IDs), sets, rep ranges, rest, and a short rationale.
4. **Validation in code:** exercise IDs exist; weekly balance within ranges. A failing option is sent back to Claude with the specific problem.
5. **You choose** from a preview in the app.
6. **Written as a draft block,** then activated to start next Monday.

**Starting weights:** known exercises from your estimated one-rep max, slightly below recent bests; new exercises estimated conservatively from related lifts, with week one as calibration.

### Editing splits

- **In the app:** add or remove days, swap exercises (suggested from the same muscle group), change sets, reps and rest, drag to reorder.
- **Via Claude:** "swap leg press for hack squat", "make Thursday 45 minutes".
- **From scratch:** build your own, or duplicate a past block.
- **Rules:** new splits are drafts until activated; mid-block edits apply from the next session; your edits are marked as yours, so the coach keeps them unless you ask; swaps to similar exercises carry strength across.

## Weekly loop, goals and nutrition

Every Sunday a scheduled job reviews the week, sets next week's loads and calories in code, then asks Claude to write the briefing and meal prep.

### Sunday job

1. **Aggregate the week:** logged sets vs prescribed, 7-day average weight vs last week, Garmin sleep and HRV.
2. **Progression (code):** per exercise, double progression. All sets at the top of the rep range → +2.5 kg upper body, +5 kg lower body. Reps missed → hold. Missed twice, or poor recovery trend → lighter week.
3. **Calories (code):** compare actual weekly weight change with the goal rate. Too fast or too slow → adjust by 100–150 kcal/day. On track → keep. Protein set from bodyweight; remaining calories split between carbs and fat.
4. **Adherence check:** one tap in the app or chat — "followed the plan: all / mostly / loosely". "Loosely" → calories are not adjusted that week.
5. **Block check:** week 12 → schedule the lighter final week and trigger split generation.
6. **Claude writes:** coaching summary, meal-prep plan, shopping list, from the computed numbers (structured JSON out).
7. **Deliver:** save to `weekly_reviews`, push notification; the frame and Claude app read the same record.

### What the briefing contains

- Weight trend vs goal rate
- Calorie and macro targets for next week (training-day and rest-day variants)
- Each lift's trend and next week's sets, reps and loads
- Meal prep: 2–3 batch-cook recipes with portion weights, daily layout, a small flex allowance, shopping list by aisle, one \~90-minute Sunday cook order
- A short coaching summary

### Goals

- Type (cut, maintain, bulk), target weight, target rate (e.g. 0.5 kg/week), optional date.
- Goals drive calories and training: on a cut the coach aims to hold strength and volume; on a bulk it progresses more aggressively.

### When Claude (AI) is used

| Moment | Frequency | Purpose |
| --- | --- | --- |
| Sunday briefing | Weekly | Summary, meal prep, shopping list |
| Split generation | Every \~12 weeks or on request | 2–3 new split options |
| Chat in the Claude app | On demand | Questions, edits, logging by voice or text |
| Optional: post-workout note | Per session | Two-line feedback |
| Optional: midweek check-in | Weekly | Nudge if trending off plan |

Everything else — logging, syncing, trends, loads, calorie targets — is deterministic code.

## Database schema

One Postgres database; each "service" is a group of tables plus Edge Functions. All tables carry `user_id` with Row Level Security.

| Table | Group | Key columns |
| --- | --- | --- |
| `profiles` | Core | user\_id, height\_cm, birth\_year, sex, units, training\_days\_per\_week |
| `goals` | Goals | id, type (cut/maintain/bulk), target\_weight\_kg, target\_rate\_kg\_wk, start\_date, target\_date, active |
| `exercises` | Library | id, name, primary\_muscles\[\], secondary\_muscles\[\], movement\_pattern, equipment\[\], source |
| `user_exercise_prefs` | Library | exercise\_id, available, favourite, avoid, notes |
| `exercise_similar` | Library | exercise\_id, similar\_exercise\_id, carryover\_factor |
| `day_templates` | Programming | id, name (e.g. Push A), focus |
| `day_template_exercises` | Programming | day\_template\_id, exercise\_id, order, sets, rep\_min, rep\_max, rest\_s, user\_pinned |
| `blocks` | Programming | id, goal\_id, split\_name, start\_date, length\_weeks, status (draft/active/done), created\_by (user/coach), rationale |
| `block_days` | Programming | block\_id, day\_template\_id, weekday, order |
| `prescribed_sets` | Programming | id, block\_id, date, exercise\_id, set\_index, target\_reps\_min, target\_reps\_max, target\_kg |
| `logged_sets` | Lifting | id, prescribed\_set\_id (nullable), exercise\_id, performed\_at, reps, kg, rpe |
| `weigh_ins` | Body | id, measured\_at, weight\_kg, body\_fat\_pct, lean\_mass\_kg, source, hc\_record\_id (unique) |
| `recovery_daily` | Recovery | date, sleep\_min, hrv\_ms, resting\_hr, steps, training\_load |
| `nutrition_targets` | Nutrition | week\_start, kcal\_train, kcal\_rest, protein\_g, carbs\_g, fat\_g, reason |
| `meal_plans` | Nutrition | week\_start, recipes (jsonb), daily\_layout (jsonb), shopping\_list (jsonb) |
| `weekly_reviews` | Coach | week\_start, metrics (jsonb), adherence, briefing\_text, briefing\_json, delivered\_at |

**Views:** `weight_trend_7d` (rolling average), `e1rm_by_exercise` (estimated one-rep max per session), `weekly_muscle_volume` (sets per muscle, secondary at 0.5).

**Deduplication:** `hc_record_id` stores the Health Connect record ID so repeated syncs never double-insert.

## API, Claude connector and frame

The phone app uses Supabase's generated REST/GraphQL for plain data and calls Edge Functions for anything with logic; the Claude app and the frame reach the same backend through narrow, separately authenticated doors.

### Edge Functions

| Function | Called by | Does |
| --- | --- | --- |
| `sync-weigh-ins` | Phone app | Upserts Health Connect records |
| `log-set` | Phone app, MCP | Records a set against its prescription |
| `plan-today` / `plan-week` | Phone app, MCP, frame | Today's session; week's loads, targets, meal prep |
| `progress` | Phone app, MCP, frame | Weight trend, e1RM trends, weekly volume |
| `weekly-review` | pg\_cron (Sunday) | The Sunday job |
| `garmin-pull` | pg\_cron (daily) | Fetches recovery data |
| `generate-split` | Phone app, MCP, weekly-review | Claude options → validate → draft block |
| `activate-block` | Phone app, MCP | Draft → active, creates prescribed sets |
| `briefing-latest` | Frame, MCP | Compact JSON of the latest review |
| `mcp` | Claude app | Remote MCP server exposing the tools below |

### Claude app connector (remote MCP)

- **Tools:** `get_today_plan`, `get_week_plan`, `log_set`, `get_progress`, `get_briefing`, `edit_split`, `propose_new_split`, `set_goal`.
- **Requirements:** public HTTPS on the standard port, reachable from Anthropic's servers; protected with OAuth or a secret.
- **Setup:** add as a custom connector once on web or desktop; it then works in the mobile app. Free plans allow one custom connector.
- Replaces WhatsApp: Meta has banned general-purpose AI chatbots on the WhatsApp Business API since 15 January 2026.

### Frame dashboard

- **Option A — TRMNL e-ink:** polls `briefing-latest` (JSON) on a schedule; monochrome, 800×600, months of battery.
- **Option B — tablet in kiosk mode:** small web dashboard on Cloudflare Pages; full colour and charts; needs power.
- **Option C — existing photo frame:** render the briefing to an image weekly and add it to the frame's album.
- The frame gets a **read-only token** limited to `briefing-latest` and `progress`.

## Read layer and data contract

Every client — phone app, frame, Claude app — reads the same small set of published objects, defined once in a versioned contract; no client reads raw tables or recalculates anything.

### Layers

1. **Raw tables** (`logged_sets`, `weigh_ins`, `recovery_daily`, …) — written by sync and logging; read only by backend code.
2. **Read layer** — Postgres views and functions that return finished answers, plus pre-computed records written by the Sunday job.
3. **API** — Supabase REST and GraphQL over the read layer; Edge Functions only where formatting differs (e.g. `/frame`).
4. **Clients** — choose fields, never compute them.

### Published objects

| Object | Source | Refresh | Phone app | Frame | Claude app |
| --- | --- | --- | --- | --- | --- |
| `today_plan` | View over `prescribed_sets` + `logged_sets` | Live | Read | — | Read |
| `week_summary` | `weekly_reviews` + live adherence | Sunday, live adherence | Read | Read | Read |
| `progress` | Views `weight_trend_7d`, `e1rm_by_exercise`, `weekly_muscle_volume` | Live | Read | Read | Read |
| `latest_briefing` | `weekly_reviews.briefing_json` | Sunday | Read | Read | Read |
| `active_block` | `blocks` + `block_days` + templates | On activation or edit | Read/write | — | Read/write |
| `goal` | `goals` (active row) | On change | Read/write | Read | Read/write |
|  |  |  |  |  |  |

### Contract rules

- **One definition:** each object is a Zod schema in a shared `contract` package; TypeScript types come from it and from `supabase gen types typescript`. App, frame and Edge Functions import the same package.
- **Envelope on every object:** `version`, `generated_at` (ISO 8601 UTC), `period` (e.g. `week_start`), then the data.
- **Units in names:** `weight_kg`, `kcal`, `protein_g`, `duration_min`; dates as ISO strings; no client-side unit conversion except display.
- **Computed once:** trends, one-rep max estimates, targets and balance scores are calculated in the backend only.
- **Validated before publish:** Edge Functions validate output against the schema — including Claude's JSON — and refuse to publish an invalid object.
- **Explicit nulls:** a missing value is `null` with a reason field where it matters (e.g. `weight_kg: null, weight_status: "no_weigh_in_this_week"`).
- **Versioning:** adding a field = same version; renaming, removing or changing meaning = new version served alongside the old until every client moves.
- **Access by key:** app = full login; frame = read-only key scoped to `week_summary`, `progress`, `latest_briefing`, `goal`; Claude connector = its own token.

### Example: `week_summary` v1

```json
{
  "version": 1,
  "generated_at": "2026-11-22T18:00:00Z",
  "week_start": "2026-11-23",
  "weight": { "avg_7d_kg": 82.1, "change_kg": -0.4, "goal_rate_kg_wk": -0.5, "status": "on_track" },
  "nutrition": { "kcal_train": 2450, "kcal_rest": 2200, "protein_g": 165, "carbs_g": 250, "fat_g": 70 },
  "training": { "sessions_done": 3, "sessions_planned": 3, "block_week": 5, "block_length": 12 },
  "lifts": [ { "exercise": "Bench press", "next_kg": 82.5, "sets": 3, "reps": "6-8", "trend": "up" } ],
  "adherence": "mostly",
  "headline": "Down 0.4 kg, bench up 2.5 kg. Same calories next week."
}
```

The frame requests a subset of these fields; the app requests all of them. Values shown are placeholders.

## Build order and risks

Build in eight steps; each is usable on its own, so you're training with the app from step 2.

1. **Foundations:** Supabase project, schema migrations, import free-exercise-db, auth.
2. **Lifting:** Expo app with a hard-coded push/pull/legs block, pre-filled sets, one-tap logging.
3. **Weight sync:** Health Connect permission, daily background sync, a debug screen listing the last 30 readings.
4. **Progression engine:** double-progression rules, e1RM and volume views, next week's prescribed sets.
5. **Goals and calories:** goal screen, weekly calorie and macro targets from weight trend.
6. **Coach:** Sunday job, Claude briefing, meal prep and shopping list, push notification.
7. **Garmin and blocks:** daily Garmin pull, recovery-aware progression; split generation, editor and balance check.
8. **Surfaces:** frame dashboard and the Claude app MCP connector.

### Setup checklist

- [ ] Connect Renpho Health to Health Connect and confirm a weigh-in appears
- [ ] Create Supabase, Anthropic Console and Expo accounts
- [ ] Generate a Garmin Personal API key
- [ ] Install Node.js, Git, VS Code, Supabase CLI, EAS CLI

### YeRisks and mitigations

| Risk | Mitigation |
| --- | --- |
| Free Supabase projects pause after 7 days without database activity | Daily syncs keep it active; Pro plan ($25/month) removes pausing |
| Health Connect needs a development build, not Expo Go | Build the APK with EAS and sideload it |
| Calorie changes assume you followed the meal plan | Weekly adherence tap; skip adjustment on "loosely" |
| Garmin Personal API is new; returned fields may change | Store raw JSON alongside parsed columns |
| Claude invents exercises or unbalanced splits | Library-only IDs plus code validation before you see options |
| pg\_graphql 1.6+ disables introspection by default | Enable it if using codegen or GraphiQL |
