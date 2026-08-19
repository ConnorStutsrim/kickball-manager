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

## Features (in progress)

- [ ] Roster management with per-player baseline scouting ratings
      (contact / power / speed / plate discipline / fielding)
- [ ] Fielding rotation generator — equal innings per player, gender-position
      limits enforced, position variety maximized
- [ ] Batting order generator using classic lineup-construction strategy
      (on-base hitters early, power/RBI hitters middle), seeded from scouting
      ratings until real stats accumulate
- [ ] Game-day stat tracking — plate appearance outcomes, baserunning events,
      qualitative defensive notes
- [ ] One-click export of a game's lineup to a live Google Sheet (batting
      order, fielding grid, scoring/outs tracker)
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

The lineup engine is a pair of pure, unit-tested functions:

- **Fielding rotation solver** — given a roster, configured positions, innings,
  and gender-position limits, produces an inning × player grid where field
  time is equalized and every inning respects the gender rules.
- **Batting order strategy** — applies classic lineup-construction heuristics
  (leadoff = on-base + speed, #3 = best hitter, cleanup = power/RBI, etc.) on
  top of a per-player "strength profile." Early in a season that profile comes
  from manually-entered scouting ratings; once enough plate appearances exist,
  it blends in real stats weighted by sample size.

## Roadmap

1. Repo scaffold (this commit)
2. Core schema + CRUD (players, league rules, seasons, games)
3. Lineup generation engine v1 (fielding solver + rating-based batting order)
4. Game-day stat tracking UI
5. Google Sheets export
6. Stats-driven lineup suggestions (blend real stats into the strategy engine)
7. Polish: season stats dashboard, demo/seed data, deploy

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
