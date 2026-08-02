ALTER TABLE "locations" ADD COLUMN "public_address_line_1" text;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "public_coordinates" geometry(point);