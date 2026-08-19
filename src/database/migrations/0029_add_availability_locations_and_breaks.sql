CREATE TABLE "availability_breaks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"availability_id" uuid NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	CONSTRAINT "availability_breaks_time_check" CHECK (end_time > start_time)
);
--> statement-breakpoint
CREATE TABLE "availability_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"availability_id" uuid NOT NULL,
	"suburb" text NOT NULL,
	"postcode" text
);
--> statement-breakpoint
ALTER TABLE "availability" ALTER COLUMN "start_time" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "availability" ALTER COLUMN "end_time" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "availability" ADD COLUMN "is_working" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "availability" ADD COLUMN "slot_interval" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "availability" ADD COLUMN "travel_time" integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "availability_breaks" ADD CONSTRAINT "availability_breaks_availability_id_fkey" FOREIGN KEY ("availability_id") REFERENCES "public"."availability"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_locations" ADD CONSTRAINT "availability_locations_availability_id_fkey" FOREIGN KEY ("availability_id") REFERENCES "public"."availability"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability" ADD CONSTRAINT "availability_instructor_day_key" UNIQUE("instructor_id","day_of_week");