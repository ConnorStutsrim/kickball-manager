ALTER TABLE "players" DROP COLUMN "rating_contact";
ALTER TABLE "players" DROP COLUMN "rating_plate_discipline";
ALTER TABLE "players" ADD COLUMN "rating_placement" smallint;
ALTER TABLE "players" ADD COLUMN "rating_bunting" smallint;
ALTER TABLE "players" ADD COLUMN "rating_baserunning" smallint;

CREATE TABLE "batting_slot_archetypes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL UNIQUE,
	"weight_power" smallint NOT NULL,
	"weight_placement" smallint NOT NULL,
	"weight_bunting" smallint NOT NULL,
	"weight_baserunning" smallint NOT NULL
);
ALTER TABLE "batting_slot_archetypes" ENABLE ROW LEVEL SECURITY;

INSERT INTO "batting_slot_archetypes" ("name", "weight_power", "weight_placement", "weight_bunting", "weight_baserunning") VALUES
	('Leadoff', 0, 0, 0, 0),
	('Table Setter', 0, 0, 0, 0),
	('Balanced', 0, 0, 0, 0),
	('Cleanup', 0, 0, 0, 0),
	('RBI', 0, 0, 0, 0);
