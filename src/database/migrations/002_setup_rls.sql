-- =============================================
-- DRIVING SCHOOL SAAS — ROW LEVEL SECURITY
-- Migration: 002_setup_rls.sql
-- =============================================

-- 1. Enabling RLS for tenant-owned tables (schools)
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- 2. Creating isolation policies based on the session variable 'app.current_school_id'

-- Schools: access only to your school
CREATE POLICY isolate_schools ON schools
  USING (id = NULLIF(current_setting('app.current_school_id', true), '')::uuid);

-- School Users
CREATE POLICY isolate_school_users ON school_users
  USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid);

-- Students
CREATE POLICY isolate_students ON students
  USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid);

-- Locations
CREATE POLICY isolate_locations ON locations
  USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid);

-- Services
CREATE POLICY isolate_services ON services
  USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid);

-- Bookings
CREATE POLICY isolate_bookings ON bookings
  USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid);

-- Booking Forms
CREATE POLICY isolate_booking_forms ON booking_forms
  USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid);

-- Invoices
CREATE POLICY isolate_invoices ON invoices
  USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid);

-- Coupons
CREATE POLICY isolate_coupons ON coupons
  USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid);

-- Invites
CREATE POLICY isolate_invites ON invites
  USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid);

-- Activity Logs
CREATE POLICY isolate_activity_logs ON activity_logs
  USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid);

-- 3. Payments (More complex policy due to connection with Bookings)
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY isolate_payments ON payments
  USING (
    booking_id IN (
      SELECT id FROM bookings 
      WHERE school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    )
  );

ALTER TABLE schools FORCE ROW LEVEL SECURITY;
ALTER TABLE school_users FORCE ROW LEVEL SECURITY;
ALTER TABLE students FORCE ROW LEVEL SECURITY;
ALTER TABLE locations FORCE ROW LEVEL SECURITY;
ALTER TABLE services FORCE ROW LEVEL SECURITY;
ALTER TABLE bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE booking_forms FORCE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;
ALTER TABLE coupons FORCE ROW LEVEL SECURITY;
ALTER TABLE invites FORCE ROW LEVEL SECURITY;
ALTER TABLE activity_logs FORCE ROW LEVEL SECURITY;