ALTER TABLE "cars" DROP CONSTRAINT "cars_transmission_check";--> statement-breakpoint
ALTER TABLE "cars" DROP CONSTRAINT "cars_fuel_check";--> statement-breakpoint
ALTER TABLE "cars" ALTER COLUMN "fuel" SET DEFAULT 'petrol';--> statement-breakpoint
UPDATE "cars" SET "transmission" = LOWER("transmission");--> statement-breakpoint
UPDATE "cars" SET "fuel" = LOWER("fuel");--> statement-breakpoint
ALTER TABLE "cars" ADD CONSTRAINT "cars_transmission_check" CHECK (transmission = ANY (ARRAY['manual'::text, 'automatic'::text]));--> statement-breakpoint
ALTER TABLE "cars" ADD CONSTRAINT "cars_fuel_check" CHECK (fuel = ANY (ARRAY['petrol'::text, 'diesel'::text, 'electric'::text, 'hybrid'::text, 'lpg'::text]));