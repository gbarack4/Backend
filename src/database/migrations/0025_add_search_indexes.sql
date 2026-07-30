ALTER TABLE "schools" ALTER COLUMN "category" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_schools_name_trgm" ON "schools" USING gin ("name" gin_trgm_ops);