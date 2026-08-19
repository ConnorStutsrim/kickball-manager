ALTER TABLE "league_rules" DROP COLUMN "gender_position_limits";
ALTER TABLE "league_rules" DROP COLUMN "roster_size";
ALTER TABLE "league_rules" ADD COLUMN "gender_minimums" jsonb NOT NULL;
