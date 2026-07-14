CREATE TABLE "instructor_onboarding_drafts" (
	"clerk_user_id" text PRIMARY KEY NOT NULL,
	"current_step_index" integer DEFAULT 0 NOT NULL,
	"form_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "instructor_onboarding_drafts" ADD CONSTRAINT "instructor_onboarding_drafts_clerk_user_id_users_clerk_user_id_fk" FOREIGN KEY ("clerk_user_id") REFERENCES "public"."users"("clerk_user_id") ON DELETE cascade ON UPDATE no action;