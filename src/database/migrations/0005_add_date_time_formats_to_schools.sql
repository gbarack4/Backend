ALTER TABLE "schools" ADD COLUMN "date_format" text DEFAULT 'DD/MM/YYYY' NOT NULL;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "time_format" text DEFAULT '24h' NOT NULL;