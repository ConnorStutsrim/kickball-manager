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
  ratingSpeed: smallint("rating_speed"),
  ratingPlateDiscipline: smallint("rating_plate_discipline"),
  ratingFielding: smallint("rating_fielding"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Single-row config table: fielding positions, gender position-limit rules, etc.
export const leagueRules = pgTable("league_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  positions: jsonb("positions").notNull().$type<string[]>(),
  genderPositionLimits: jsonb("gender_position_limits").notNull().$type<
    Record<string, { gender: Gender; max: number }[]>
  >(),
  inningsPerGame: integer("innings_per_game").notNull().default(7),
  rosterSize: integer("roster_size"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const seasons = pgTable("seasons", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  year: integer("year").notNull(),
});

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
});

export const lineups = pgTable("lineups", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const battingOrderEntries = pgTable("batting_order_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  lineupId: uuid("lineup_id")
    .notNull()
    .references(() => lineups.id, { onDelete: "cascade" }),
  playerId: uuid("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  battingPosition: integer("batting_position").notNull(),
});

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
});

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
});

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
});

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
});
