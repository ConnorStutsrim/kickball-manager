ALTER TABLE "players" DROP COLUMN "rating_fielding";
ALTER TABLE "players" ADD COLUMN "rating_catching" smallint;
ALTER TABLE "players" ADD COLUMN "rating_throwing" smallint;
ALTER TABLE "players" ADD COLUMN "rating_game_sense" smallint;

ALTER TABLE "league_rules" DROP COLUMN "positions";

CREATE TABLE "positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL UNIQUE,
	"short_code" text NOT NULL,
	"display_order" integer NOT NULL,
	"importance" smallint NOT NULL,
	"weight_speed" smallint NOT NULL,
	"weight_catching" smallint NOT NULL,
	"weight_throwing" smallint NOT NULL,
	"weight_game_sense" smallint NOT NULL
);
ALTER TABLE "positions" ENABLE ROW LEVEL SECURITY;

INSERT INTO "positions" ("name", "short_code", "display_order", "importance", "weight_speed", "weight_catching", "weight_throwing", "weight_game_sense") VALUES
	('Pitcher', 'P', 1, 0, 0, 0, 0, 0),
	('Catcher', 'C', 2, 0, 0, 0, 0, 0),
	('First Base', '1B', 3, 0, 0, 0, 0, 0),
	('Second Base', '2B', 4, 0, 0, 0, 0, 0),
	('Third Base', '3B', 5, 0, 0, 0, 0, 0),
	('Shortstop', 'SS', 6, 0, 0, 0, 0, 0),
	('Monster', 'Monster', 7, 0, 0, 0, 0, 0),
	('Left Field', 'LF', 8, 0, 0, 0, 0, 0),
	('Center Left Field', 'CLF', 9, 0, 0, 0, 0, 0),
	('Center Right Field', 'CRF', 10, 0, 0, 0, 0, 0),
	('Right Field', 'RF', 11, 0, 0, 0, 0, 0);
