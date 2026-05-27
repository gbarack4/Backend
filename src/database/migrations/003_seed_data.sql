-- =============================================
-- DRIVING SCHOOL SAAS — SEED DATA
-- Migration: 003_seed_data.sql
-- =============================================

-- Temporarily disable RLS to fill the database
ALTER TABLE schools DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE school_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE instructors DISABLE ROW LEVEL SECURITY;
ALTER TABLE instructor_schools DISABLE ROW LEVEL SECURITY;
ALTER TABLE students DISABLE ROW LEVEL SECURITY;
ALTER TABLE services DISABLE ROW LEVEL SECURITY;
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;

-- 1. Creating fixed UUIDs for tenants
-- School 1: 11111111-1111-1111-1111-111111111111
-- School 2: 22222222-2222-2222-2222-222222222222

INSERT INTO schools (id, name, slug, domain, timezone) VALUES
('11111111-1111-1111-1111-111111111111', 'Fast Track Driving', 'fast-track', 'fasttrack.com', 'UTC'),
('22222222-2222-2222-2222-222222222222', 'Safe Drive Academy', 'safe-drive', 'safedrive.com', 'UTC')
ON CONFLICT DO NOTHING;

-- 2. Creating users (Owners, Instructors, Students)
INSERT INTO users (id, clerk_user_id, email, role) VALUES
('33333333-3333-3333-3333-333333333331', 'user_clerk_owner1', 'owner1@fasttrack.com', 'owner'),
('33333333-3333-3333-3333-333333333332', 'user_clerk_owner2', 'owner2@safedrive.com', 'owner'),
('44444444-4444-4444-4444-444444444441', 'user_clerk_instr1', 'john.instructor@mail.com', 'instructor'),
('55555555-5555-5555-5555-555555555551', 'user_clerk_stud1', 'student1@mail.com', 'student')
ON CONFLICT DO NOTHING;

-- 3. We connect owners to their schools
INSERT INTO school_users (user_id, school_id, role) VALUES
('33333333-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111', 'owner'),
('33333333-3333-3333-3333-333333333332', '22222222-2222-2222-2222-222222222222', 'owner')
ON CONFLICT DO NOTHING;

-- 4. Add an instructor and link him to School 1
INSERT INTO instructors (id, user_id, name, phone, status) VALUES
('66666666-6666-6666-6666-666666666661', '44444444-4444-4444-4444-444444444441', 'John Doe', '+1234567890', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO instructor_schools (instructor_id, school_id, status, source) VALUES
('66666666-6666-6666-6666-666666666661', '11111111-1111-1111-1111-111111111111', 'accepted', 'school_invite')
ON CONFLICT DO NOTHING;

-- 5. Adding a student to School 1
INSERT INTO students (id, school_id, user_id, name, email) VALUES
('77777777-7777-7777-7777-777777777771', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555551', 'Alice Smith', 'student1@mail.com')
ON CONFLICT DO NOTHING;

-- 6. Adding a Service for School 1
INSERT INTO services (id, school_id, name, price_type, base_price) VALUES
('88888888-8888-8888-8888-888888888881', '11111111-1111-1111-1111-111111111111', 'Standard Driving Lesson', 'fixed', 50.00)
ON CONFLICT DO NOTHING;

-- 7. Adding a test booking
INSERT INTO bookings (id, school_id, student_id, instructor_id, service_id, start_datetime, end_datetime, status) VALUES
('99999999-9999-9999-9999-999999999991', 
 '11111111-1111-1111-1111-111111111111', -- School 1
 '77777777-7777-7777-7777-777777777771', -- Alice
 '66666666-6666-6666-6666-666666666661', -- John
 '88888888-8888-8888-8888-888888888881', -- Lesson
 NOW() + INTERVAL '1 day', 
 NOW() + INTERVAL '1 day 2 hours', 
 'confirmed')
ON CONFLICT DO NOTHING;

-- Turning RLS on again
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructor_schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;