-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "instructor_schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instructor_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"responded_at" timestamp with time zone,
	CONSTRAINT "instructor_schools_instructor_id_school_id_key" UNIQUE("instructor_id","school_id"),
	CONSTRAINT "instructor_schools_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'blocked'::text])),
	CONSTRAINT "instructor_schools_source_check" CHECK (source = ANY (ARRAY['instructor_request'::text, 'school_invite'::text]))
);
--> statement-breakpoint
ALTER TABLE "instructor_schools" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "locations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"domain" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "schools_slug_key" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "schools" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_type" text NOT NULL,
	"base_price" numeric(10, 2),
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "services_price_type_check" CHECK (price_type = ANY (ARRAY['fixed'::text, 'hourly'::text, 'custom'::text]))
);
--> statement-breakpoint
ALTER TABLE "services" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "school_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "school_users_user_id_school_id_key" UNIQUE("user_id","school_id"),
	CONSTRAINT "school_users_role_check" CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text]))
);
--> statement-breakpoint
ALTER TABLE "school_users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "instructors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "instructors_user_id_key" UNIQUE("user_id"),
	CONSTRAINT "instructors_status_check" CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text]))
);
--> statement-breakpoint
ALTER TABLE "instructors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instructor_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"is_recurring" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "availability_day_of_week_check" CHECK ((day_of_week >= 0) AND (day_of_week <= 6))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_clerk_user_id_key" UNIQUE("clerk_user_id"),
	CONSTRAINT "users_email_key" UNIQUE("email"),
	CONSTRAINT "users_role_check" CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text, 'instructor'::text, 'student'::text]))
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "availability_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instructor_id" uuid NOT NULL,
	"start_datetime" timestamp with time zone NOT NULL,
	"end_datetime" timestamp with time zone NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"student_id" uuid,
	"instructor_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"location_id" uuid,
	"start_datetime" timestamp with time zone NOT NULL,
	"end_datetime" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_price" numeric(10, 2),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "bookings_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text])),
	CONSTRAINT "bookings_check" CHECK (end_datetime > start_datetime)
);
--> statement-breakpoint
ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "booking_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "booking_forms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "form_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"label" text NOT NULL,
	"field_type" text NOT NULL,
	"required" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"field_id" uuid NOT NULL,
	"label" text NOT NULL,
	"price_modifier" numeric(10, 2)
);
--> statement-breakpoint
CREATE TABLE "pricing_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"field_id" uuid NOT NULL,
	"condition_json" jsonb,
	"price_adjustment" numeric(10, 2)
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"student_id" uuid,
	"booking_id" uuid,
	"total_amount" numeric(10, 2) NOT NULL,
	"status" text NOT NULL,
	"due_date" date,
	CONSTRAINT "invoices_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'sent'::text, 'paid'::text, 'overdue'::text]))
);
--> statement-breakpoint
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'unread' NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "notifications_status_check" CHECK (status = ANY (ARRAY['unread'::text, 'read'::text]))
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "invites_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text]))
);
--> statement-breakpoint
ALTER TABLE "invites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"instructor_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	CONSTRAINT "reviews_rating_check" CHECK ((rating >= 1) AND (rating <= 5))
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"code" text NOT NULL,
	"discount_type" text NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"expiry_date" date,
	CONSTRAINT "coupons_discount_type_check" CHECK (discount_type = ANY (ARRAY['percent'::text, 'fixed'::text]))
);
--> statement-breakpoint
ALTER TABLE "coupons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"method" text,
	"status" text NOT NULL,
	"transaction_ref" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "payments_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'refunded'::text]))
);
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"action" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "instructor_schools" ADD CONSTRAINT "instructor_schools_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructor_schools" ADD CONSTRAINT "instructor_schools_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_users" ADD CONSTRAINT "school_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_users" ADD CONSTRAINT "school_users_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructors" ADD CONSTRAINT "instructors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability" ADD CONSTRAINT "availability_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_blocks" ADD CONSTRAINT "availability_blocks_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_forms" ADD CONSTRAINT "booking_forms_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_forms" ADD CONSTRAINT "booking_forms_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."booking_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_options" ADD CONSTRAINT "field_options_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "public"."form_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "public"."form_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_school_users_school_id" ON "school_users" USING btree ("school_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_students_school_id" ON "students" USING btree ("school_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_bookings_instructor_id" ON "bookings" USING btree ("instructor_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_bookings_school_id" ON "bookings" USING btree ("school_id" uuid_ops);--> statement-breakpoint
CREATE POLICY "isolate_locations" ON "locations" AS PERMISSIVE FOR ALL TO public USING ((school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid));--> statement-breakpoint
CREATE POLICY "isolate_schools" ON "schools" AS PERMISSIVE FOR ALL TO public USING ((id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid));--> statement-breakpoint
CREATE POLICY "isolate_services" ON "services" AS PERMISSIVE FOR ALL TO public USING ((school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid));--> statement-breakpoint
CREATE POLICY "isolate_school_users" ON "school_users" AS PERMISSIVE FOR ALL TO public USING ((school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid));--> statement-breakpoint
CREATE POLICY "isolate_students" ON "students" AS PERMISSIVE FOR ALL TO public USING ((school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid));--> statement-breakpoint
CREATE POLICY "isolate_bookings" ON "bookings" AS PERMISSIVE FOR ALL TO public USING ((school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid));--> statement-breakpoint
CREATE POLICY "isolate_booking_forms" ON "booking_forms" AS PERMISSIVE FOR ALL TO public USING ((school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid));--> statement-breakpoint
CREATE POLICY "isolate_invoices" ON "invoices" AS PERMISSIVE FOR ALL TO public USING ((school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid));--> statement-breakpoint
CREATE POLICY "isolate_invites" ON "invites" AS PERMISSIVE FOR ALL TO public USING ((school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid));--> statement-breakpoint
CREATE POLICY "isolate_coupons" ON "coupons" AS PERMISSIVE FOR ALL TO public USING ((school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid));--> statement-breakpoint
CREATE POLICY "isolate_payments" ON "payments" AS PERMISSIVE FOR ALL TO public USING ((booking_id IN ( SELECT bookings.id
   FROM bookings
  WHERE (bookings.school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid))));--> statement-breakpoint
CREATE POLICY "isolate_activity_logs" ON "activity_logs" AS PERMISSIVE FOR ALL TO public USING ((school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid));
*/