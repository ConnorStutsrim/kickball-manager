CREATE TABLE "player_position_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"position_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	CONSTRAINT "player_position_overrides_player_id_position_id_unique" UNIQUE("player_id","position_id")
);
--> statement-breakpoint
ALTER TABLE "player_position_overrides" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "player_position_overrides" ADD CONSTRAINT "player_position_overrides_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_position_overrides" ADD CONSTRAINT "player_position_overrides_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE cascade ON UPDATE no action;