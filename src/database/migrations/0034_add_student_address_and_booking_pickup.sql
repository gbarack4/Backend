ALTER TABLE "bookings" ADD COLUMN "pickup_address" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "pickup_coordinates" geometry(point);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "pickup_google_place_id" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "address_suburb" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "address_postcode" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "address_coordinates" geometry(point);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "address_google_place_id" text;