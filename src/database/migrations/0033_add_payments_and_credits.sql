CREATE TABLE "package_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"purchased_minutes" integer NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'aud' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "package_purchases_status_check" CHECK (status = ANY (
        ARRAY[
          'pending'::text,
          'paid'::text,
          'failed'::text,
          'expired'::text
        ]
      )),
	CONSTRAINT "package_purchases_minutes_check" CHECK (purchased_minutes > 0)
);
--> statement-breakpoint
ALTER TABLE "package_purchases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "student_credit_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"balance_minutes" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "student_credit_balances_school_student_key" UNIQUE("school_id","student_id"),
	CONSTRAINT "student_credit_balances_non_negative_check" CHECK (balance_minutes >= 0)
);
--> statement-breakpoint
ALTER TABLE "student_credit_balances" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "student_credit_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"package_purchase_id" uuid,
	"booking_id" uuid,
	"type" text NOT NULL,
	"delta_minutes" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "student_credit_transactions_idempotency_key" UNIQUE("idempotency_key"),
	CONSTRAINT "student_credit_transactions_type_check" CHECK (type = ANY (
        ARRAY[
          'package_credit'::text,
          'booking_use'::text,
          'booking_cancelled'::text,
          'manual_adjustment'::text
        ]
      )),
	CONSTRAINT "student_credit_transactions_delta_check" CHECK (delta_minutes <> 0)
);
--> statement-breakpoint
ALTER TABLE "student_credit_transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_status_check";--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_status_check";--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_booking_id_fkey";
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "package_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "package_purchase_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "booking_source" text DEFAULT 'package' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancelled_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payment_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "school_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "student_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "package_purchase_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "currency" text DEFAULT 'aud' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "stripe_account_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "stripe_payment_intent_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "failure_message" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "stripe_account_id" text;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "stripe_charges_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "stripe_payouts_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "stripe_details_submitted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "package_purchases" ADD CONSTRAINT "package_purchases_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_purchases" ADD CONSTRAINT "package_purchases_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_purchases" ADD CONSTRAINT "package_purchases_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_credit_balances" ADD CONSTRAINT "student_credit_balances_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_credit_balances" ADD CONSTRAINT "student_credit_balances_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_credit_transactions" ADD CONSTRAINT "student_credit_transactions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_credit_transactions" ADD CONSTRAINT "student_credit_transactions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_credit_transactions" ADD CONSTRAINT "student_credit_transactions_purchase_id_fkey" FOREIGN KEY ("package_purchase_id") REFERENCES "public"."package_purchases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_credit_transactions" ADD CONSTRAINT "student_credit_transactions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_package_purchases_school_id" ON "package_purchases" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "idx_package_purchases_student_id" ON "package_purchases" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_credit_transactions_school_id" ON "student_credit_transactions" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "idx_credit_transactions_student_id" ON "student_credit_transactions" USING btree ("student_id");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_package_purchase_id_fkey" FOREIGN KEY ("package_purchase_id") REFERENCES "public"."package_purchases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancelled_by_user_id_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_package_purchase_id_fkey" FOREIGN KEY ("package_purchase_id") REFERENCES "public"."package_purchases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_payments_school_id" ON "payments" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "idx_payments_student_id" ON "payments" USING btree ("student_id");--> statement-breakpoint
DROP POLICY IF EXISTS "isolate_payments" ON "payments";
--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "booking_id";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "method";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "transaction_ref";--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_stripe_payment_intent_id_key" UNIQUE("stripe_payment_intent_id");--> statement-breakpoint
ALTER TABLE "schools" ADD CONSTRAINT "schools_stripe_account_id_key" UNIQUE("stripe_account_id");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_source_check" CHECK (booking_source = ANY (
    ARRAY[
      'package'::text,
      'credit'::text
    ]
  ));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_status_check" CHECK (status = ANY (
    ARRAY[
      'pending'::text,
      'confirmed'::text,
      'completed'::text,
      'cancelled'::text,
      'expired'::text
    ]
  ));--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_status_check" CHECK (status = ANY (
        ARRAY[
          'pending'::text,
          'paid'::text,
          'failed'::text,
          'cancelled'::text
        ]
      ));--> statement-breakpoint
CREATE POLICY "isolate_package_purchases" ON "package_purchases" AS PERMISSIVE FOR ALL TO public USING (school_id = (
        NULLIF(
          current_setting('app.current_school_id'::text, true),
          ''
        )
      )::uuid);--> statement-breakpoint
CREATE POLICY "isolate_student_credit_balances" ON "student_credit_balances" AS PERMISSIVE FOR ALL TO public USING (school_id = (
        NULLIF(
          current_setting('app.current_school_id'::text, true),
          ''
        )
      )::uuid);--> statement-breakpoint
CREATE POLICY "isolate_student_credit_transactions" ON "student_credit_transactions" AS PERMISSIVE FOR ALL TO public USING (school_id = (
        NULLIF(
          current_setting('app.current_school_id'::text, true),
          ''
        )
      )::uuid);--> statement-breakpoint
CREATE POLICY "isolate_payments"
ON "payments"
AS PERMISSIVE
FOR ALL
TO public
USING (
  school_id = (
    NULLIF(
      current_setting('app.current_school_id'::text, true),
      ''
    )
  )::uuid
);