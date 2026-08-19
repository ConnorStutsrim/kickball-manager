# Kickball Manager

A web app for managing a coed rec kickball team: generating batting orders and
fielding lineups that respect fairness and gender-position rules, tracking
in-game stats, and exporting each game to a live Google Sheet.

## Why this exists

Recreational coed kickball leagues have a few recurring headaches on game day:
everyone needs to bat every inning, everyone should get equal time in the
field, fielding has to respect gender-position limits, and someone has to
build all of that into a lineup by hand — then track outs and scoring on a
spreadsheet during the game. This app automates the lineup construction and
gives that spreadsheet a real data model behind it.

## Features

- [x] Roster management with per-player baseline scouting ratings (batting:
      contact / power / speed / plate discipline; fielding: catching /
      throwing / game sense — speed pulls double duty for both)
- [x] Fielding rotation generator — equal field-innings per player (seeded
      round-robin bench rotation), the league's per-inning gender minimums
      enforced, and best-fit position assignment via a from-scratch Hungarian
      algorithm over each player's predicted aptitude at each position
- [x] Configurable position model — per-position importance and skill weights
      (how much speed/catching/throwing/game-sense predicts success there)
- [x] Batting order generator using classic lineup-construction strategy
      (on-base hitters early, power/RBI hitters middle), seeded from scouting
      ratings until real stats accumulate
- [x] Manual overrides — reorder the batting order, swap fielding assignments
      per inning, after generating
- [x] Live game-day tracking — one-tap plate-appearance entry that auto-advances
      through the batting order, a derived (not stored) inning/outs/score state,
      per-inning scoreboard. Baserunning-event and defensive-note logging are
      built but not working in practice yet; a redesign is tracked in
      [#5](https://github.com/ConnorStutsrim/kickball-manager/issues/5)
- [x] Google Sheets export — one-click per-game spreadsheet (fielding grid,
      batting order, blank scoring section for live use), shaped after the
      team's own existing spreadsheet; regenerating updates the same sheet
      rather than creating a new one
- [ ] Season stat history feeding back into lineup suggestions

## Tech stack

- **Framework:** Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Database:** Postgres via [Supabase](https://supabase.com)
- **ORM:** [Drizzle](https://orm.drizzle.team)
- **Auth:** Supabase Auth (single allow-listed user)
- **Sheets export:** Google Sheets API (`googleapis`, OAuth2)
- **Hosting:** Vercel (app) + Supabase (DB/auth)
- **Testing:** Vitest (unit) + Playwright (e2e)
- **CI:** GitHub Actions

## Architecture

```
┌────────────────────┐      ┌──────────────────────┐
│  Next.js app        │      │  Supabase             │
│  (Vercel)            │◄────►│  Postgres + Auth      │
│                      │      └──────────────────────┘
│  - Roster/lineup UI  │
│  - Lineup engine     │      ┌──────────────────────┐
│  - Stat tracking UI  │◄────►│  Google Sheets API     │
└────────────────────┘      │  (per-game export)     │
                              └──────────────────────┘
```

The lineup engine is a set of pure, unit-tested functions (`src/lib/lineup/`):

- **Fielding rotation solver** — bench rotation keeps field-innings equal per
  player (seeded round-robin), a repair step enforces the league's per-inning
  gender minimums, and position assignment is a pure best-fit optimization:
  an importance-weighted optimal assignment (Hungarian algorithm) over each
  player's predicted aptitude at every position.
- **Position aptitude** — predicts a player's fit for a position as a
  weighted average of their skill axes (speed / catching / throwing / game
  sense), weighted by how predictive each axis is of that specific position
  — configurable per position, not hardcoded.
- **Batting order strategy** — applies classic lineup-construction heuristics
  (leadoff = on-base + speed, #3 = best hitter, cleanup = power/RBI, etc.) on
  top of a per-player "strength profile." Early in a season that profile comes
  from manually-entered scouting ratings; once enough plate appearances exist,
  it will blend in real stats weighted by sample size (not built yet).

Game state during live tracking (`src/lib/game/game-state.ts`) is computed,
not stored: whose turn it is, the inning/half/outs, and the running score are
all derived from the recorded plate appearances, baserunning events, and
opponent per-inning runs on every read — there's no separate "current state"
row that could drift out of sync with the play-by-play data.

## Roadmap

1. ✅ Repo scaffold
2. ✅ Core schema + CRUD (players, league rules, positions, seasons, games)
3. ✅ Lineup generation engine (fielding solver + best-fit position assignment
   + rating-based batting order)
4. ✅ Live game-day stat tracking (derived game state, plate appearances,
   opponent scoring) — baserunning/defensive-note logging shipped but isn't
   working in practice; redesign tracked in
   [#5](https://github.com/ConnorStutsrim/kickball-manager/issues/5)
5. ✅ Google Sheets export (per-game spreadsheet matching the team's real
   sheet, OAuth-connected, regenerate-in-place)
6. ⬜ Stats-driven lineup suggestions (blend real stats into the strategy
   engine) *(next)*
7. ⬜ Polish: season stats dashboard, demo/seed data, deploy

Smaller tracked work: see [open issues](https://github.com/ConnorStutsrim/kickball-manager/issues).

## Local development

```bash
npm install
cp .env.example .env.local  # fill in Supabase + Google credentials
npm run dev
```

Other scripts:

```bash
npm run lint        # eslint
npm run typecheck    # tsc --noEmit
npm run test         # vitest
npm run db:generate  # generate a Drizzle migration from src/db/schema.ts
npm run db:migrate   # apply migrations
npm run db:studio    # browse the DB with Drizzle Studio
```
