import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  smallint,
  unique,
} from "drizzle-orm/pg-core";

export const genderEnum = ["M", "F"] as const;
export type Gender = (typeof genderEnum)[number];

export const plateAppearanceResultEnum = [
  "single",
  "double",
  "triple",
  "home_run",
  "walk",
  "out",
  "fielders_choice",
  "sac",
  "reached_on_error",
] as const;
export type PlateAppearanceResult = (typeof plateAppearanceResultEnum)[number];

export const baserunningEventTypeEnum = [
  "steal",
  "caught_stealing",
  "advanced",
  "scored",
] as const;
export type BaserunningEventType = (typeof baserunningEventTypeEnum)[number];

export const defensiveNoteTagEnum = ["great_play", "error", "assist"] as const;
export type DefensiveNoteTag = (typeof defensiveNoteTagEnum)[number];

export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  gender: text("gender", { enum: genderEnum }).notNull(),
  active: boolean("active").notNull().default(true),
  // Baseline qualitative attribute ratings (1-5), used as the lineup-construction
  // prior before enough real plate appearances exist to derive stats from.
  ratingContact: smallint("rating_contact"),
  ratingPower: smallint("rating_power"),
  // Speed doubles as a fielding-range signal in the position-aptitude model.
  ratingSpeed: smallint("rating_speed"),
  ratingPlateDiscipline: smallint("rating_plate_discipline"),
  // Fielding skill axes (predict position aptitude via positions.weight_*).
  ratingCatching: smallint("rating_catching"),
  ratingThrowing: smallint("rating_throwing"),
  ratingGameSense: smallint("rating_game_sense"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

// One row per fielding position: how much each skill axis predicts success
// there (weight_*), and the position's relative importance. Both drive the
// fielding solver's optimal (Hungarian-algorithm) position assignment.
export const positions = pgTable("positions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  shortCode: text("short_code").notNull(),
  displayOrder: integer("display_order").notNull(),
  importance: smallint("importance").notNull(),
  weightSpeed: smallint("weight_speed").notNull(),
  weightCatching: smallint("weight_catching").notNull(),
  weightThrowing: smallint("weight_throwing").notNull(),
  weightGameSense: smallint("weight_game_sense").notNull(),
}).enableRLS();

// Single-row config table: gender minimums, innings per game, etc.
export const leagueRules = pgTable("league_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Whole-field floor per gender among that inning's fielders, e.g.
  // [{ gender: "M", min: 4 }, { gender: "F", min: 4 }].
  genderMinimums: jsonb("gender_minimums").notNull().$type<
    { gender: Gender; min: number }[]
  >(),
  inningsPerGame: integer("innings_per_game").notNull().default(7),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export const seasons = pgTable("seasons", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  year: integer("year").notNull(),
}).enableRLS();

export const games = pgTable("games", {
  id: uuid("id").primaryKey().defaultRandom(),
  seasonId: uuid("season_id")
    .notNull()
    .references(() => seasons.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  opponent: text("opponent"),
  location: text("location"),
  inningsPlanned: integer("innings_planned").notNull().default(7),
  sheetUrl: text("sheet_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export const lineups = pgTable("lineups", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export const battingOrderEntries = pgTable("batting_order_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  lineupId: uuid("lineup_id")
    .notNull()
    .references(() => lineups.id, { onDelete: "cascade" }),
  playerId: uuid("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  battingPosition: integer("batting_position").notNull(),
}).enableRLS();

// position value "BENCH" represents a player not fielding that inning.
export const fieldingAssignments = pgTable("fielding_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  lineupId: uuid("lineup_id")
    .notNull()
    .references(() => lineups.id, { onDelete: "cascade" }),
  inning: integer("inning").notNull(),
  playerId: uuid("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  position: text("position").notNull(),
}).enableRLS();

// The opponent's roster isn't tracked in detail — just their runs per half-inning.
export const opponentInningRuns = pgTable(
  "opponent_inning_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    inning: integer("inning").notNull(),
    runs: integer("runs").notNull(),
  },
  (table) => [unique().on(table.gameId, table.inning)],
).enableRLS();

export const plateAppearances = pgTable("plate_appearances", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  playerId: uuid("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  inning: integer("inning").notNull(),
  battingPosition: integer("batting_position").notNull(),
  result: text("result", { enum: plateAppearanceResultEnum }).notNull(),
  rbi: integer("rbi").notNull().default(0),
  runsScored: boolean("runs_scored").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export const baserunningEvents = pgTable("baserunning_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  playerId: uuid("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  inning: integer("inning").notNull(),
  eventType: text("event_type", { enum: baserunningEventTypeEnum }).notNull(),
  notes: text("notes"),
}).enableRLS();

export const defensiveNotes = pgTable("defensive_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  playerId: uuid("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  inning: integer("inning").notNull(),
  position: text("position").notNull(),
  note: text("note").notNull(),
  tag: text("tag", { enum: defensiveNoteTagEnum }),
}).enableRLS();
