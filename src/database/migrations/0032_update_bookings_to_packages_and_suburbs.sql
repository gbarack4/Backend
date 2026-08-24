ALTER TABLE "bookings" DROP CONSTRAINT "bookings_status_check";--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_service_id_fkey";
--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_location_id_fkey";
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "package_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "pickup_suburb" text NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "pickup_postcode" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "service_id";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "location_id";--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_status_check" CHECK (status = ANY (
        ARRAY[
          'pending'::text,
          'confirmed'::text,
          'completed'::text,
          'cancelled'::text
        ]
      ));--> statement-breakpoint
ALTER POLICY "isolate_bookings" ON "bookings" TO public USING (
        (school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid)
        OR
        (instructor_id IN (
          SELECT id
          FROM instructors
          WHERE user_id = (
            NULLIF(
              current_setting('app.current_user_id'::text, true),
              ''
            )
          )::uuid
        ))
      );