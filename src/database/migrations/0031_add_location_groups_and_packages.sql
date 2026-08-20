CREATE TABLE "location_group_suburbs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"suburb" text NOT NULL,
	"postcode" text
);
--> statement-breakpoint
CREATE TABLE "location_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "location_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"location_group_id" uuid NOT NULL,
	"name" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "packages_status_check" CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'archived'::text]))
);
--> statement-breakpoint
ALTER TABLE "packages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "hourly_rate" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "location_group_suburbs" ADD CONSTRAINT "location_group_suburbs_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."location_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_groups" ADD CONSTRAINT "location_groups_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_location_group_id_fkey" FOREIGN KEY ("location_group_id") REFERENCES "public"."location_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "isolate_location_groups" ON "location_groups" AS PERMISSIVE FOR ALL TO public USING ((school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid));--> statement-breakpoint
CREATE POLICY "isolate_packages" ON "packages" AS PERMISSIVE FOR ALL TO public USING ((school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid));