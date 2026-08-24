CREATE TABLE "position_shore_up_weights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"helper_position_id" uuid NOT NULL,
	"helped_position_id" uuid NOT NULL,
	"weight" smallint NOT NULL,
	CONSTRAINT "position_shore_up_weights_helper_position_id_helped_position_id_unique" UNIQUE("helper_position_id","helped_position_id")
);
--> statement-breakpoint
ALTER TABLE "position_shore_up_weights" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "position_shore_up_weights" ADD CONSTRAINT "position_shore_up_weights_helper_position_id_positions_id_fk" FOREIGN KEY ("helper_position_id") REFERENCES "public"."positions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "position_shore_up_weights" ADD CONSTRAINT "position_shore_up_weights_helped_position_id_positions_id_fk" FOREIGN KEY ("helped_position_id") REFERENCES "public"."positions"("id") ON DELETE cascade ON UPDATE no action;
