CREATE TABLE "cars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"instructor_id" uuid,
	"make" text NOT NULL,
	"model" text NOT NULL,
	"year" integer NOT NULL,
	"color" text NOT NULL,
	"transmission" text NOT NULL,
	"fuel" text NOT NULL,
	"image_url" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "cars_transmission_check" CHECK (transmission = ANY (ARRAY['Manual'::text, 'Automatic'::text])),
	CONSTRAINT "cars_fuel_check" CHECK (fuel = ANY (ARRAY['Petrol'::text, 'Diesel'::text, 'Electric'::text, 'Hybrid'::text, 'LPG'::text])),
	CONSTRAINT "cars_status_check" CHECK (status = ANY (ARRAY['active'::text, 'maintenance'::text, 'retired'::text])),
	CONSTRAINT "cars_year_check" CHECK (year >= 1990 AND year <= extract(year from now())::int + 1)
);
--> statement-breakpoint
ALTER TABLE "cars" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "instructors" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "instructors" ADD COLUMN "price_per_hour" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "cars" ADD CONSTRAINT "cars_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cars" ADD CONSTRAINT "cars_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_cars_school_id" ON "cars" USING btree ("school_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_cars_instructor_id" ON "cars" USING btree ("instructor_id" uuid_ops);--> statement-breakpoint
CREATE POLICY "isolate_cars" ON "cars" AS PERMISSIVE FOR ALL TO public USING ((school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid));--> statement-breakpoint
ALTER TABLE "cars" FORCE ROW LEVEL SECURITY;