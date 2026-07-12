ALTER TABLE "users" DROP CONSTRAINT "users_role_check";--> statement-breakpoint
ALTER TABLE "cars" ALTER COLUMN "school_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cars" ALTER COLUMN "fuel" SET DEFAULT 'Petrol';--> statement-breakpoint
ALTER TABLE "cars" ADD COLUMN "dual_control" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "instructors" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "instructors" ADD COLUMN "address_line_1" text;--> statement-breakpoint
ALTER TABLE "instructors" ADD COLUMN "address_line_2" text;--> statement-breakpoint
ALTER TABLE "instructors" ADD COLUMN "suburb" text;--> statement-breakpoint
ALTER TABLE "instructors" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "instructors" ADD COLUMN "postcode" text;--> statement-breakpoint
ALTER TABLE "instructors" ADD COLUMN "emergency_contact" jsonb;--> statement-breakpoint
ALTER TABLE "instructors" ADD COLUMN "driver_licence_number" text;--> statement-breakpoint
ALTER TABLE "instructors" ADD COLUMN "driver_licence_expiry" text;--> statement-breakpoint
ALTER TABLE "instructors" ADD COLUMN "instructor_accreditation_number" text;--> statement-breakpoint
ALTER TABLE "instructors" ADD COLUMN "accreditation_expiry" text;--> statement-breakpoint
ALTER TABLE "instructors" ADD COLUMN "years_of_experience" integer;--> statement-breakpoint
ALTER TABLE "instructors" ADD COLUMN "transmission_type" text;--> statement-breakpoint
ALTER TABLE "instructors" ADD COLUMN "languages_spoken" text;--> statement-breakpoint
ALTER TABLE "instructors" ADD COLUMN "documents" jsonb;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_school_id_user_id_key" UNIQUE("school_id","user_id");--> statement-breakpoint
ALTER POLICY "isolate_bookings" ON "bookings" TO public USING (
        (school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid)
        OR 
        (instructor_id IN (
          SELECT id FROM instructors 
          WHERE user_id = (NULLIF(current_setting('app.current_user_id'::text, true), ''::text))::uuid
        ))
      );