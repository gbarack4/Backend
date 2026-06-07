CREATE TABLE "school_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"type" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "school_domains_type_check" CHECK (type = ANY (ARRAY['subdomain'::text, 'custom'::text]))
);
--> statement-breakpoint
ALTER TABLE "school_domains" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "school_websites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "school_websites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "website_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "owner_user_id" uuid;
UPDATE "schools" SET "owner_user_id" = (SELECT "id" FROM "users" ORDER BY "created_at" LIMIT 1);
ALTER TABLE "schools" ALTER COLUMN "owner_user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "google_reviews_api_key" text;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "subscription_status" text DEFAULT 'trialing' NOT NULL;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "trial_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "school_domains" ADD CONSTRAINT "school_domains_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_websites" ADD CONSTRAINT "school_websites_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_websites" ADD CONSTRAINT "school_websites_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."website_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_school_domains_domain" ON "school_domains" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "idx_school_websites_school_id" ON "school_websites" USING btree ("school_id");--> statement-breakpoint
ALTER TABLE "schools" ADD CONSTRAINT "schools_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schools" DROP COLUMN "domain";--> statement-breakpoint
ALTER TABLE "schools" ADD CONSTRAINT "schools_status_check" CHECK (status = ANY (ARRAY['onboarding'::text, 'active'::text, 'suspended'::text]));--> statement-breakpoint
ALTER TABLE "schools" ADD CONSTRAINT "schools_subscription_status_check" CHECK (subscription_status = ANY (ARRAY['trialing'::text, 'active'::text, 'past_due'::text, 'canceled'::text, 'inactive'::text]));--> statement-breakpoint
CREATE POLICY "isolate_school_domains" ON "school_domains" AS PERMISSIVE FOR ALL TO public USING ((school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid));--> statement-breakpoint
CREATE POLICY "isolate_school_websites" ON "school_websites" AS PERMISSIVE FOR ALL TO public USING ((school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid));