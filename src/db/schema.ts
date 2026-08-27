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

// Only "advanced"/"scored" are real events in this league — it doesn't
// allow stealing.
export const baserunningEventTypeEnum = ["advanced", "scored"] as const;
export type BaserunningEventType = (typeof baserunningEventTypeEnum)[number];

export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  gender: text("gender", { enum: genderEnum }).notNull(),
  active: boolean("active").notNull().default(true),
  // Baseline qualitative batting ratings (1-10), used as the
  // lineup-construction prior before enough real plate appearances exist to
  // derive stats from. Predict batting-slot-archetype fit via
  // batting_slot_archetypes.weight_*. Fielding fit isn't rated here — it's
  // rated directly per position in player_position_ratings below.
  ratingPower: smallint("rating_power"),
  ratingPlacement: smallint("rating_placement"),
  ratingBunting: smallint("rating_bunting"),
  ratingBaserunning: smallint("rating_baserunning"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

// One row per fielding position: its relative importance, weighted into the
// fielding solver's optimal (Hungarian-algorithm) position assignment
// alongside each player's rating at that position (player_position_ratings).
export const positions = pgTable("positions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  shortCode: text("short_code").notNull(),
  displayOrder: integer("display_order").notNull(),
  importance: smallint("importance").notNull(),
}).enableRLS();

// A player's rating (1-10) at a specific fielding position, entered
// directly rather than derived from a skill-axis formula. Not every player
// needs a rating at every position — a missing row defaults to average (5)
// — hence a sparse join table rather than a wide column on `players`.
export const playerPositionRatings = pgTable(
  "player_position_ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    positionId: uuid("position_id")
      .notNull()
      .references(() => positions.id, { onDelete: "cascade" }),
    rating: smallint("rating").notNull(),
  },
  (table) => [unique().on(table.playerId, table.positionId)],
).enableRLS();

// How much one position ("helper") can cover for a weak neighbor ("helped")
// in the fielding solver's optimization — e.g. a strong middle left fielder
// covering ground for a weaker left fielder. Directional (helper->helped is
// independent of helped->helper) and 0-10, not this app's usual 1-10: 0 ("no
// coverage relationship") is the real, common default for most position
// pairs, unlike other rating fields where every value matters at least a
// little. Every ordered pair of distinct positions gets a row, seeded at 0.
export const positionShoreUpWeights = pgTable(
  "position_shore_up_weights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    helperPositionId: uuid("helper_position_id")
      .notNull()
      .references(() => positions.id, { onDelete: "cascade" }),
    helpedPositionId: uuid("helped_position_id")
      .notNull()
      .references(() => positions.id, { onDelete: "cascade" }),
    weight: smallint("weight").notNull(),
  },
  (table) => [unique().on(table.helperPositionId, table.helpedPositionId)],
).enableRLS();

// One row per batting-order-slot archetype (Leadoff, Table Setter, Balanced,
// Cleanup, RBI): how much each batting skill axis predicts fit for that
// archetype. Slot number -> archetype name is a fixed mapping in code
// (src/lib/lineup/batting-order.ts); only the per-archetype weights here
// are configurable.
export const battingSlotArchetypes = pgTable("batting_slot_archetypes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  weightPower: smallint("weight_power").notNull(),
  weightPlacement: smallint("weight_placement").notNull(),
  weightBunting: smallint("weight_bunting").notNull(),
  weightBaserunning: smallint("weight_baserunning").notNull(),
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

// Single-row: the OAuth refresh token for Connor's own Google account,
// used to generate/update per-game Sheets exports.
export const googleAuth = pgTable("google_auth", {
  id: uuid("id").primaryKey().defaultRandom(),
  refreshToken: text("refresh_token").notNull(),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
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
  // Was this plate appearance a bunt attempt? Independent of `result` (a
  // bunt can end in a single, an out, a sac, etc.) — feeds the Bunting
  // batting-stat signal once enough bunt attempts accumulate.
  isBunt: boolean("is_bunt").notNull().default(false),
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
