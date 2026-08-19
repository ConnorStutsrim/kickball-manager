CREATE TABLE "opponent_inning_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"inning" integer NOT NULL,
	"runs" integer NOT NULL,
	CONSTRAINT "opponent_inning_runs_game_id_inning_unique" UNIQUE("game_id","inning")
);
--> statement-breakpoint
ALTER TABLE "opponent_inning_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "opponent_inning_runs" ADD CONSTRAINT "opponent_inning_runs_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;