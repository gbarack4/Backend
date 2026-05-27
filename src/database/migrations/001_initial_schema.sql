-- =============================================
-- DRIVING SCHOOL SAAS — INITIAL SCHEMA
-- Migration: 001_initial_schema.sql
-- =============================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- CORE: USERS & SCHOOLS
-- =============================================

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL UNIQUE,
  role          TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'staff', 'instructor', 'student')),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE schools (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  domain      TEXT,
  timezone    TEXT NOT NULL DEFAULT 'UTC',
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE school_users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'staff')),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, school_id)
);

-- =============================================
-- INSTRUCTORS
-- =============================================

CREATE TABLE instructors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE instructor_schools (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id  UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  school_id      UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
  source         TEXT NOT NULL CHECK (source IN ('instructor_request', 'school_invite')),
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at   TIMESTAMP WITH TIME ZONE,
  UNIQUE (instructor_id, school_id)
);

-- =============================================
-- STUDENTS
-- =============================================

CREATE TABLE students (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- LOCATIONS & SERVICES
-- =============================================

CREATE TABLE locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  address     TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE services (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  price_type   TEXT NOT NULL CHECK (price_type IN ('fixed', 'hourly', 'custom')),
  base_price   NUMERIC(10, 2),
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- AVAILABILITY
-- =============================================

CREATE TABLE availability (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  day_of_week   INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun, 6=Sat
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  is_recurring  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE availability_blocks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id  UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  end_datetime   TIMESTAMP WITH TIME ZONE NOT NULL,
  reason         TEXT,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- BOOKINGS
-- =============================================

CREATE TABLE bookings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id     UUID REFERENCES students(id) ON DELETE SET NULL,
  instructor_id  UUID NOT NULL REFERENCES instructors(id) ON DELETE RESTRICT,
  service_id     UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  location_id    UUID REFERENCES locations(id) ON DELETE SET NULL,
  start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  end_datetime   TIMESTAMP WITH TIME ZONE NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  total_price    NUMERIC(10, 2),
  notes          TEXT,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (end_datetime > start_datetime)
);

-- =============================================
-- BOOKING FORMS
-- =============================================

CREATE TABLE booking_forms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  service_id  UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE form_fields (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id     UUID NOT NULL REFERENCES booking_forms(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  field_type  TEXT NOT NULL,
  required    BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE field_options (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id        UUID NOT NULL REFERENCES form_fields(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,
  price_modifier  NUMERIC(10, 2)
);

CREATE TABLE pricing_rules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id         UUID NOT NULL REFERENCES form_fields(id) ON DELETE CASCADE,
  condition_json   JSONB,
  price_adjustment NUMERIC(10, 2)
);

-- =============================================
-- PAYMENTS & INVOICES
-- =============================================

CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount          NUMERIC(10, 2) NOT NULL,
  method          TEXT,
  status          TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  transaction_ref TEXT,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE invoices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id   UUID REFERENCES students(id) ON DELETE SET NULL,
  booking_id   UUID REFERENCES bookings(id) ON DELETE SET NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('draft', 'sent', 'paid', 'overdue')),
  due_date     DATE
);

-- =============================================
-- REVIEWS
-- =============================================

CREATE TABLE reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  rating        INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT
);

-- =============================================
-- COUPONS, NOTIFICATIONS, INVITES, LOGS
-- =============================================

CREATE TABLE coupons (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  code          TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  value         NUMERIC(10, 2) NOT NULL,
  expiry_date   DATE
);

CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  message    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read')),
  sent_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE invites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  role       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE activity_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  action     TEXT NOT NULL,
  metadata   JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Creating an exclusion constraint (Exclusion Constraint)
ALTER TABLE bookings
ADD CONSTRAINT prevent_instructor_double_booking
EXCLUDE USING gist (
  instructor_id WITH =,
  tstzrange(start_datetime, end_datetime) WITH &&
) WHERE (status IN ('pending', 'confirmed'));

CREATE INDEX idx_school_users_school_id ON school_users(school_id);
CREATE INDEX idx_students_school_id ON students(school_id);
CREATE INDEX idx_bookings_school_id ON bookings(school_id);
CREATE INDEX idx_bookings_instructor_id ON bookings(instructor_id);