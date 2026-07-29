ALTER TABLE "locations" ADD COLUMN "coordinates" geometry(point);--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "google_place_id" text;--> statement-breakpoint
CREATE INDEX "idx_locations_coordinates" ON "locations" USING gist ("coordinates");