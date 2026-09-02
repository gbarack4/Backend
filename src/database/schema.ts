import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  foreignKey,
  geometry,
  index,
  integer,
  jsonb,
  numeric,
  pgPolicy,
  pgTable,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import type { InstructorDocuments } from '@/instructors/types/instructor-documents.type';

export const instructorSchools = pgTable(
  'instructor_schools',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    instructorId: uuid('instructor_id').notNull(),
    schoolId: uuid('school_id').notNull(),
    status: text().default('pending').notNull(),
    source: text().notNull(),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
    respondedAt: timestamp('responded_at', {
      withTimezone: true,
      mode: 'string',
    }),
  },
  (table) => [
    foreignKey({
      columns: [table.instructorId],
      foreignColumns: [instructors.id],
      name: 'instructor_schools_instructor_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.schoolId],
      foreignColumns: [schools.id],
      name: 'instructor_schools_school_id_fkey',
    }).onDelete('cascade'),
    unique('instructor_schools_instructor_id_school_id_key').on(table.instructorId, table.schoolId),
    check(
      'instructor_schools_status_check',
      sql`status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'blocked'::text, 'paused'::text])`,
    ),
    check(
      'instructor_schools_source_check',
      sql`source = ANY (ARRAY['instructor_request'::text, 'school_invite'::text])`,
    ),
    pgPolicy('isolate_instructor_schools_school', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid)`,
    }),
    pgPolicy('isolate_instructor_schools_instructor', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`instructor_id IN (SELECT id FROM instructors WHERE user_id = (NULLIF(current_setting('app.current_user_id'::text, true), ''::text))::uuid)`,
    }),
  ],
).enableRLS();

export const locations = pgTable(
  'locations',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    schoolId: uuid('school_id').notNull(),
    name: text().notNull(),
    address: text(),
    addressLine1: text('address_line_1'),
    addressLine2: text('address_line_2'),
    suburb: text('suburb'),
    state: text('state'),
    postcode: text('postcode'),
    coordinates: geometry('coordinates', {
      type: 'point',
      mode: 'xy',
      srid: 4326,
    }),
    googlePlaceId: text('google_place_id'),
    publicAddressLine1: text('public_address_line_1'),
    publicCoordinates: geometry('public_coordinates', {
      type: 'Point',
      srid: 4326,
    }),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.schoolId],
      foreignColumns: [schools.id],
      name: 'locations_school_id_fkey',
    }).onDelete('cascade'),
    index('idx_locations_coordinates').using('gist', table.coordinates),
    pgPolicy('isolate_locations', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid)`,
    }),
  ],
);

export const schools = pgTable(
  'schools',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    ownerUserId: uuid('owner_user_id').notNull(),
    name: text().notNull(),
    email: text('email'),
    phone: text('phone'),
    category: text('category').notNull(),
    description: text('description'),
    coverImageUrl: text('cover_image_url'),
    logoUrl: text('logo_url'),
    slug: text().notNull(),
    status: text().default('active').notNull(),
    googleBusinessUrl: text('google_business_url'),
    googleAccessToken: text('google_access_token'),
    googleRefreshToken: text('google_refresh_token'),
    googleAccountId: text('google_account_id'),
    googleAccountName: text('google_account_name'),
    googleLocationName: text('google_location_name'),
    timezone: text().default('UTC').notNull(),
    dateFormat: text('date_format').default('DD/MM/YYYY').notNull(),
    timeFormat: text('time_format').default('24h').notNull(),
    hourlyRate: numeric('hourly_rate', { precision: 10, scale: 2 }),
    subscriptionStatus: text('subscription_status').default('trialing').notNull(),
    trialEndsAt: timestamp('trial_ends_at', {
      withTimezone: true,
      mode: 'string',
    }),

    stripeAccountId: text('stripe_account_id'),
    stripeChargesEnabled: boolean('stripe_charges_enabled').default(false).notNull(),
    stripePayoutsEnabled: boolean('stripe_payouts_enabled').default(false).notNull(),
    stripeDetailsSubmitted: boolean('stripe_details_submitted').default(false).notNull(),

    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
    updatedAt: timestamp('updated_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.ownerUserId],
      foreignColumns: [users.id],
      name: 'schools_owner_user_id_fkey',
    }).onDelete('restrict'),

    unique('schools_slug_key').on(table.slug),
    unique('schools_stripe_account_id_key').on(table.stripeAccountId),
    index('idx_schools_name_trgm').using('gin', table.name.op('gin_trgm_ops')),
    check(
      'schools_status_check',
      sql`status = ANY (ARRAY['onboarding'::text, 'active'::text, 'suspended'::text])`,
    ),
    check(
      'schools_subscription_status_check',
      sql`subscription_status = ANY (ARRAY['trialing'::text, 'active'::text, 'past_due'::text, 'canceled'::text, 'inactive'::text])`,
    ),

    pgPolicy('isolate_schools', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid)`,
    }),
  ],
);

export const services = pgTable(
  'services',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    schoolId: uuid('school_id').notNull(),
    name: text().notNull(),
    description: text(),
    priceType: text('price_type').notNull(),
    basePrice: numeric('base_price', { precision: 10, scale: 2 }),
    durationMinutes: integer('duration_minutes').default(60).notNull(),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.schoolId],
      foreignColumns: [schools.id],
      name: 'services_school_id_fkey',
    }).onDelete('cascade'),
    pgPolicy('isolate_services', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid)`,
    }),
    check(
      'services_price_type_check',
      sql`price_type = ANY (ARRAY['fixed'::text, 'hourly'::text, 'custom'::text])`,
    ),
  ],
);

export const schoolUsers = pgTable(
  'school_users',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    schoolId: uuid('school_id').notNull(),
    role: text().notNull(),
    permission: text(),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
  },
  (table) => [
    index('idx_school_users_school_id').using(
      'btree',
      table.schoolId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'school_users_user_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.schoolId],
      foreignColumns: [schools.id],
      name: 'school_users_school_id_fkey',
    }).onDelete('cascade'),
    unique('school_users_user_id_school_id_key').on(table.userId, table.schoolId),
    pgPolicy('isolate_school_users', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid)`,
    }),
    check(
      'school_users_role_check',
      sql`role = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text])`,
    ),
    check(
      'school_users_permission_check',
      sql`permission IS NULL OR permission = ANY (ARRAY['view'::text, 'edit'::text])`,
    ),
    check(
      'school_users_owner_permission_check',
      sql`(role = 'owner' AND permission IS NULL) OR (role <> 'owner' AND permission IS NOT NULL)`,
    ),
  ],
);

export const students = pgTable(
  'students',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    schoolId: uuid('school_id').notNull(),
    userId: uuid('user_id'),
    name: text().notNull(),
    email: text(),
    phone: text(),
    avatarUrl: text('avatar_url'),
    address: text('address'),
    addressSuburb: text('address_suburb'),
    addressPostcode: text('address_postcode'),
    addressCoordinates: geometry('address_coordinates', {
      type: 'point',
      mode: 'xy',
      srid: 4326,
    }),
    addressGooglePlaceId: text('address_google_place_id'),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
  },
  (table) => [
    index('idx_students_school_id').using('btree', table.schoolId.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.schoolId],
      foreignColumns: [schools.id],
      name: 'students_school_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'students_user_id_fkey',
    }).onDelete('set null'),
    unique('students_school_id_user_id_key').on(table.schoolId, table.userId),
    pgPolicy('isolate_students', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid)`,
    }),
  ],
);

export const instructors = pgTable(
  'instructors',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    name: text().notNull(),
    phone: text(),
    bio: text(),
    pricePerHour: numeric('price_per_hour', { precision: 10, scale: 2 }),
    avatarUrl: text('avatar_url'),
    addressLine1: text('address_line_1'),
    addressLine2: text('address_line_2'),
    suburb: text('suburb'),
    state: text('state'),
    postcode: text('postcode'),
    emergencyContact: jsonb('emergency_contact').$type<{ name: string; phone: string }>(),
    driverLicenceNumber: text('driver_licence_number'),
    driverLicenceExpiry: text('driver_licence_expiry'),
    instructorAccreditationNumber: text('instructor_accreditation_number'),
    accreditationExpiry: text('accreditation_expiry'),
    yearsOfExperience: integer('years_of_experience'),
    transmissionType: text('transmission_type'),
    languagesSpoken: text('languages_spoken'),
    documents: jsonb('documents').$type<InstructorDocuments>(),
    status: text().default('active').notNull(),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'instructors_user_id_fkey',
    }).onDelete('cascade'),
    unique('instructors_user_id_key').on(table.userId),
    check('instructors_status_check', sql`status = ANY (ARRAY['active'::text, 'inactive'::text])`),
  ],
).enableRLS();

export const cars = pgTable(
  'cars',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    schoolId: uuid('school_id'),
    instructorId: uuid('instructor_id'),
    make: text().notNull(),
    model: text().notNull(),
    year: integer().notNull(),
    registrationNumber: text('registration_number').notNull(),
    color: text().notNull(),
    transmission: text().notNull(),
    fuel: text().default('petrol').notNull(),
    dualControl: boolean('dual_control').default(false).notNull(),
    imageUrl: text('image_url'),
    status: text().default('active').notNull(),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
  },
  (table) => [
    index('idx_cars_school_id').using('btree', table.schoolId.asc().nullsLast().op('uuid_ops')),
    index('idx_cars_instructor_id').using(
      'btree',
      table.instructorId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.schoolId],
      foreignColumns: [schools.id],
      name: 'cars_school_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.instructorId],
      foreignColumns: [instructors.id],
      name: 'cars_instructor_id_fkey',
    }).onDelete('set null'),
    pgPolicy('isolate_cars', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid)`,
    }),
    check(
      'cars_transmission_check',
      sql`transmission = ANY (ARRAY['manual'::text, 'automatic'::text])`,
    ),
    check(
      'cars_fuel_check',
      sql`fuel = ANY (ARRAY['petrol'::text, 'diesel'::text, 'electric'::text, 'hybrid'::text, 'lpg'::text])`,
    ),
    check(
      'cars_status_check',
      sql`status = ANY (ARRAY['active'::text, 'maintenance'::text, 'retired'::text])`,
    ),
    check('cars_year_check', sql`year >= 1990 AND year <= extract(year from now())::int + 1`),
  ],
).enableRLS();

export const availability = pgTable(
  'availability',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    instructorId: uuid('instructor_id').notNull(),
    dayOfWeek: integer('day_of_week').notNull(),
    isWorking: boolean('is_working').default(true).notNull(),
    startTime: time('start_time'),
    endTime: time('end_time'),
    slotInterval: integer('slot_interval').default(30).notNull(),
    travelTime: integer('travel_time').default(15).notNull(),
    isRecurring: boolean('is_recurring').default(true).notNull(),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.instructorId],
      foreignColumns: [instructors.id],
      name: 'availability_instructor_id_fkey',
    }).onDelete('cascade'),
    check('availability_day_of_week_check', sql`(day_of_week >= 0) AND (day_of_week <= 6)`),
    unique('availability_instructor_day_key').on(table.instructorId, table.dayOfWeek),
  ],
);

export const availabilityLocations = pgTable(
  'availability_locations',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    availabilityId: uuid('availability_id').notNull(),

    suburb: text('suburb').notNull(),
    postcode: text('postcode'),

    coordinates: geometry('coordinates', {
      type: 'point',
      mode: 'xy',
      srid: 4326,
    }),
  },
  (table) => [
    foreignKey({
      columns: [table.availabilityId],
      foreignColumns: [availability.id],
      name: 'availability_locations_availability_id_fkey',
    }).onDelete('cascade'),
  ],
);

export const availabilityBreaks = pgTable(
  'availability_breaks',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    availabilityId: uuid('availability_id').notNull(),
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.availabilityId],
      foreignColumns: [availability.id],
      name: 'availability_breaks_availability_id_fkey',
    }).onDelete('cascade'),
    check('availability_breaks_time_check', sql`end_time > start_time`),
  ],
);

export const users = pgTable(
  'users',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    clerkUserId: text('clerk_user_id').notNull(),
    email: text().notNull(),
    firstName: text('first_name'),
    lastName: text('last_name'),
    phoneNumber: text('phone_number'),
    address: text('address'),
    avatarUrl: text('avatar_url'),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
  },
  (table) => [
    unique('users_clerk_user_id_key').on(table.clerkUserId),
    unique('users_email_key').on(table.email),
  ],
).enableRLS();

export const availabilityBlocks = pgTable(
  'availability_blocks',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    instructorId: uuid('instructor_id').notNull(),
    startDatetime: timestamp('start_datetime', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    endDatetime: timestamp('end_datetime', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    reason: text(),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.instructorId],
      foreignColumns: [instructors.id],
      name: 'availability_blocks_instructor_id_fkey',
    }).onDelete('cascade'),
  ],
);

export const bookings = pgTable(
  'bookings',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),

    schoolId: uuid('school_id').notNull(),
    studentId: uuid('student_id'),
    instructorId: uuid('instructor_id').notNull(),

    packageId: uuid('package_id'),
    packagePurchaseId: uuid('package_purchase_id'),
    bookingSource: text('booking_source').default('package').notNull(),

    pickupAddress: text('pickup_address'),
    pickupSuburb: text('pickup_suburb').notNull(),
    pickupPostcode: text('pickup_postcode'),
    pickupCoordinates: geometry('pickup_coordinates', {
      type: 'point',
      mode: 'xy',
      srid: 4326,
    }),
    pickupGooglePlaceId: text('pickup_google_place_id'),

    startDatetime: timestamp('start_datetime', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),

    endDatetime: timestamp('end_datetime', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),

    status: text().default('pending').notNull(),

    totalPrice: numeric('total_price', {
      precision: 10,
      scale: 2,
    }),

    notes: text(),

    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),

    confirmedAt: timestamp('confirmed_at', {
      withTimezone: true,
      mode: 'string',
    }),
    completedAt: timestamp('completed_at', {
      withTimezone: true,
      mode: 'string',
    }),
    cancelledAt: timestamp('cancelled_at', {
      withTimezone: true,
      mode: 'string',
    }),
    cancelledByUserId: uuid('cancelled_by_user_id'),
    paymentExpiresAt: timestamp('payment_expires_at', {
      withTimezone: true,
      mode: 'string',
    }),
  },
  (table) => [
    index('idx_bookings_instructor_id').using(
      'btree',
      table.instructorId.asc().nullsLast().op('uuid_ops'),
    ),

    index('idx_bookings_school_id').using('btree', table.schoolId.asc().nullsLast().op('uuid_ops')),

    foreignKey({
      columns: [table.schoolId],
      foreignColumns: [schools.id],
      name: 'bookings_school_id_fkey',
    }).onDelete('cascade'),

    foreignKey({
      columns: [table.studentId],
      foreignColumns: [students.id],
      name: 'bookings_student_id_fkey',
    }).onDelete('set null'),

    foreignKey({
      columns: [table.instructorId],
      foreignColumns: [instructors.id],
      name: 'bookings_instructor_id_fkey',
    }).onDelete('restrict'),

    foreignKey({
      columns: [table.packageId],
      foreignColumns: [packages.id],
      name: 'bookings_package_id_fkey',
    }).onDelete('restrict'),

    foreignKey({
      columns: [table.packagePurchaseId],
      foreignColumns: [packagePurchases.id],
      name: 'bookings_package_purchase_id_fkey',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.cancelledByUserId],
      foreignColumns: [users.id],
      name: 'bookings_cancelled_by_user_id_fkey',
    }).onDelete('set null'),

    pgPolicy('isolate_bookings', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`
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
      `,
    }),

    check(
      'bookings_status_check',
      sql`status = ANY (
    ARRAY[
      'pending'::text,
      'confirmed'::text,
      'completed'::text,
      'cancelled'::text,
      'expired'::text
    ]
  )`,
    ),

    check(
      'bookings_source_check',
      sql`booking_source = ANY (
    ARRAY[
      'package'::text,
      'credit'::text
    ]
  )`,
    ),
    check('bookings_check', sql`end_datetime > start_datetime`),
  ],
);

export const bookingForms = pgTable(
  'booking_forms',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    schoolId: uuid('school_id').notNull(),
    serviceId: uuid('service_id').notNull(),
    type: text().notNull(),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.schoolId],
      foreignColumns: [schools.id],
      name: 'booking_forms_school_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.serviceId],
      foreignColumns: [services.id],
      name: 'booking_forms_service_id_fkey',
    }).onDelete('cascade'),
    pgPolicy('isolate_booking_forms', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid)`,
    }),
  ],
);

export const formFields = pgTable(
  'form_fields',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    formId: uuid('form_id').notNull(),
    label: text().notNull(),
    fieldType: text('field_type').notNull(),
    required: boolean().default(false).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.formId],
      foreignColumns: [bookingForms.id],
      name: 'form_fields_form_id_fkey',
    }).onDelete('cascade'),
  ],
);

export const fieldOptions = pgTable(
  'field_options',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    fieldId: uuid('field_id').notNull(),
    label: text().notNull(),
    priceModifier: numeric('price_modifier', { precision: 10, scale: 2 }),
  },
  (table) => [
    foreignKey({
      columns: [table.fieldId],
      foreignColumns: [formFields.id],
      name: 'field_options_field_id_fkey',
    }).onDelete('cascade'),
  ],
);

export const pricingRules = pgTable(
  'pricing_rules',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    fieldId: uuid('field_id').notNull(),
    conditionJson: jsonb('condition_json'),
    priceAdjustment: numeric('price_adjustment', { precision: 10, scale: 2 }),
  },
  (table) => [
    foreignKey({
      columns: [table.fieldId],
      foreignColumns: [formFields.id],
      name: 'pricing_rules_field_id_fkey',
    }).onDelete('cascade'),
  ],
);

export const invoices = pgTable(
  'invoices',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    schoolId: uuid('school_id').notNull(),
    studentId: uuid('student_id'),
    bookingId: uuid('booking_id'),
    totalAmount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
    status: text().notNull(),
    dueDate: date('due_date'),
  },
  (table) => [
    foreignKey({
      columns: [table.schoolId],
      foreignColumns: [schools.id],
      name: 'invoices_school_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.studentId],
      foreignColumns: [students.id],
      name: 'invoices_student_id_fkey',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.bookingId],
      foreignColumns: [bookings.id],
      name: 'invoices_booking_id_fkey',
    }).onDelete('set null'),
    pgPolicy('isolate_invoices', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid)`,
    }),
    check(
      'invoices_status_check',
      sql`status = ANY (ARRAY['draft'::text, 'sent'::text, 'paid'::text, 'overdue'::text])`,
    ),
  ],
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    type: text().notNull(),
    message: text().notNull(),
    status: text().default('unread').notNull(),
    sentAt: timestamp('sent_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'notifications_user_id_fkey',
    }).onDelete('cascade'),
    check('notifications_status_check', sql`status = ANY (ARRAY['unread'::text, 'read'::text])`),
  ],
);

export const invites = pgTable(
  'invites',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    schoolId: uuid('school_id').notNull(),
    email: text().notNull(),
    role: text().notNull(),
    status: text().default('pending').notNull(),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.schoolId],
      foreignColumns: [schools.id],
      name: 'invites_school_id_fkey',
    }).onDelete('cascade'),
    pgPolicy('isolate_invites', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid)`,
    }),
    check(
      'invites_status_check',
      sql`status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text])`,
    ),
  ],
);

export const reviews = pgTable(
  'reviews',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    bookingId: uuid('booking_id').notNull(),
    studentId: uuid('student_id').notNull(),
    instructorId: uuid('instructor_id').notNull(),
    rating: integer().notNull(),
    comment: text(),
  },
  (table) => [
    foreignKey({
      columns: [table.bookingId],
      foreignColumns: [bookings.id],
      name: 'reviews_booking_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.studentId],
      foreignColumns: [students.id],
      name: 'reviews_student_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.instructorId],
      foreignColumns: [instructors.id],
      name: 'reviews_instructor_id_fkey',
    }).onDelete('cascade'),
    check('reviews_rating_check', sql`(rating >= 1) AND (rating <= 5)`),
  ],
);

export const coupons = pgTable(
  'coupons',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    schoolId: uuid('school_id').notNull(),
    code: text().notNull(),
    discountType: text('discount_type').notNull(),
    value: numeric({ precision: 10, scale: 2 }).notNull(),
    expiryDate: date('expiry_date'),
  },
  (table) => [
    foreignKey({
      columns: [table.schoolId],
      foreignColumns: [schools.id],
      name: 'coupons_school_id_fkey',
    }).onDelete('cascade'),
    pgPolicy('isolate_coupons', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid)`,
    }),
    check(
      'coupons_discount_type_check',
      sql`discount_type = ANY (ARRAY['percent'::text, 'fixed'::text])`,
    ),
  ],
);

export const payments = pgTable(
  'payments',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),

    schoolId: uuid('school_id').notNull(),
    studentId: uuid('student_id').notNull(),
    packagePurchaseId: uuid('package_purchase_id').notNull(),

    amount: numeric({
      precision: 10,
      scale: 2,
    }).notNull(),

    currency: text().default('aud').notNull(),

    status: text().default('pending').notNull(),

    stripeAccountId: text('stripe_account_id').notNull(),
    stripePaymentIntentId: text('stripe_payment_intent_id').notNull(),

    failureMessage: text('failure_message'),

    paidAt: timestamp('paid_at', {
      withTimezone: true,
      mode: 'string',
    }),

    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
  },
  (table) => [
    index('idx_payments_school_id').on(table.schoolId),
    index('idx_payments_student_id').on(table.studentId),

    unique('payments_stripe_payment_intent_id_key').on(table.stripePaymentIntentId),

    foreignKey({
      columns: [table.schoolId],
      foreignColumns: [schools.id],
      name: 'payments_school_id_fkey',
    }).onDelete('restrict'),

    foreignKey({
      columns: [table.studentId],
      foreignColumns: [students.id],
      name: 'payments_student_id_fkey',
    }).onDelete('restrict'),

    foreignKey({
      columns: [table.packagePurchaseId],
      foreignColumns: [packagePurchases.id],
      name: 'payments_package_purchase_id_fkey',
    }).onDelete('restrict'),

    check(
      'payments_status_check',
      sql`status = ANY (
        ARRAY[
          'pending'::text,
          'paid'::text,
          'failed'::text,
          'cancelled'::text
        ]
      )`,
    ),

    pgPolicy('isolate_payments', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`school_id = (
        NULLIF(
          current_setting('app.current_school_id'::text, true),
          ''
        )
      )::uuid`,
    }),
  ],
).enableRLS();

export const studentCreditBalances = pgTable(
  'student_credit_balances',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),

    schoolId: uuid('school_id').notNull(),
    studentId: uuid('student_id').notNull(),

    balanceMinutes: integer('balance_minutes').default(0).notNull(),

    updatedAt: timestamp('updated_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
  },
  (table) => [
    unique('student_credit_balances_school_student_key').on(table.schoolId, table.studentId),

    foreignKey({
      columns: [table.schoolId],
      foreignColumns: [schools.id],
      name: 'student_credit_balances_school_id_fkey',
    }).onDelete('cascade'),

    foreignKey({
      columns: [table.studentId],
      foreignColumns: [students.id],
      name: 'student_credit_balances_student_id_fkey',
    }).onDelete('cascade'),

    check('student_credit_balances_non_negative_check', sql`balance_minutes >= 0`),

    pgPolicy('isolate_student_credit_balances', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`school_id = (
        NULLIF(
          current_setting('app.current_school_id'::text, true),
          ''
        )
      )::uuid`,
    }),
  ],
).enableRLS();

export const studentCreditTransactions = pgTable(
  'student_credit_transactions',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),

    schoolId: uuid('school_id').notNull(),
    studentId: uuid('student_id').notNull(),

    packagePurchaseId: uuid('package_purchase_id'),
    bookingId: uuid('booking_id'),

    type: text().notNull(),

    deltaMinutes: integer('delta_minutes').notNull(),

    idempotencyKey: text('idempotency_key').notNull(),

    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
  },
  (table) => [
    index('idx_credit_transactions_school_id').on(table.schoolId),
    index('idx_credit_transactions_student_id').on(table.studentId),

    unique('student_credit_transactions_idempotency_key').on(table.idempotencyKey),

    foreignKey({
      columns: [table.schoolId],
      foreignColumns: [schools.id],
      name: 'student_credit_transactions_school_id_fkey',
    }).onDelete('restrict'),

    foreignKey({
      columns: [table.studentId],
      foreignColumns: [students.id],
      name: 'student_credit_transactions_student_id_fkey',
    }).onDelete('restrict'),

    foreignKey({
      columns: [table.packagePurchaseId],
      foreignColumns: [packagePurchases.id],
      name: 'student_credit_transactions_purchase_id_fkey',
    }).onDelete('set null'),

    foreignKey({
      columns: [table.bookingId],
      foreignColumns: [bookings.id],
      name: 'student_credit_transactions_booking_id_fkey',
    }).onDelete('set null'),

    check(
      'student_credit_transactions_type_check',
      sql`type = ANY (
        ARRAY[
          'package_credit'::text,
          'booking_use'::text,
          'booking_cancelled'::text,
          'manual_adjustment'::text
        ]
      )`,
    ),

    check('student_credit_transactions_delta_check', sql`delta_minutes <> 0`),

    pgPolicy('isolate_student_credit_transactions', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`school_id = (
        NULLIF(
          current_setting('app.current_school_id'::text, true),
          ''
        )
      )::uuid`,
    }),
  ],
).enableRLS();

export const activityLogs = pgTable(
  'activity_logs',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    schoolId: uuid('school_id').notNull(),
    action: text().notNull(),
    metadata: jsonb(),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.schoolId],
      foreignColumns: [schools.id],
      name: 'activity_logs_school_id_fkey',
    }).onDelete('cascade'),
    pgPolicy('isolate_activity_logs', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid)`,
    }),
  ],
);

export const schoolDomains = pgTable(
  'school_domains',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    schoolId: uuid('school_id').notNull(),
    domain: text().notNull(),
    type: text().notNull(),
    isPrimary: boolean('is_primary').default(false).notNull(),
    status: text().default('active').notNull(),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
  },
  (table) => [
    unique('school_domains_domain_key').on(table.domain),

    foreignKey({
      columns: [table.schoolId],
      foreignColumns: [schools.id],
      name: 'school_domains_school_id_fkey',
    }).onDelete('cascade'),
    check('school_domains_type_check', sql`type = ANY (ARRAY['subdomain'::text, 'custom'::text])`),

    pgPolicy('isolate_school_domains', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid)`,
    }),
  ],
).enableRLS();

export const websiteTemplates = pgTable(
  'website_templates',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    config: jsonb().default({}).notNull(),
  },
  (table) => [unique('website_templates_name_key').on(table.name)],
);

export const schoolWebsites = pgTable(
  'school_websites',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    schoolId: uuid('school_id').notNull(),
    templateId: uuid('template_id').notNull(),
    status: text().default('active').notNull(),
    config: jsonb().default({}).notNull(),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
    updatedAt: timestamp('updated_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
  },
  (table) => [
    index('idx_school_websites_school_id').on(table.schoolId),
    foreignKey({
      columns: [table.schoolId],
      foreignColumns: [schools.id],
      name: 'school_websites_school_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.templateId],
      foreignColumns: [websiteTemplates.id],
      name: 'school_websites_template_id_fkey',
    }).onDelete('restrict'),
    pgPolicy('isolate_school_websites', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid)`,
    }),
  ],
).enableRLS();

export const instructorOnboardingDrafts = pgTable('instructor_onboarding_drafts', {
  clerkUserId: text('clerk_user_id')
    .primaryKey()
    .references(() => users.clerkUserId, { onDelete: 'cascade' }),
  currentStepIndex: integer('current_step_index').notNull().default(0),
  formData: jsonb('form_data').notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const locationGroups = pgTable(
  'location_groups',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    schoolId: uuid('school_id').notNull(),
    name: text().notNull(),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
    updatedAt: timestamp('updated_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.schoolId],
      foreignColumns: [schools.id],
      name: 'location_groups_school_id_fkey',
    }).onDelete('cascade'),
    pgPolicy('isolate_location_groups', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid)`,
    }),
  ],
).enableRLS();

export const locationGroupSuburbs = pgTable(
  'location_group_suburbs',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    groupId: uuid('group_id').notNull(),
    suburb: text('suburb').notNull(),
    postcode: text('postcode'),
  },
  (table) => [
    foreignKey({
      columns: [table.groupId],
      foreignColumns: [locationGroups.id],
      name: 'location_group_suburbs_group_id_fkey',
    }).onDelete('cascade'),
  ],
);

export const packages = pgTable(
  'packages',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    schoolId: uuid('school_id').notNull(),
    locationGroupId: uuid('location_group_id').notNull(),
    name: text().notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    price: numeric({ precision: 10, scale: 2 }).notNull(),
    status: text().default('active').notNull(),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
    updatedAt: timestamp('updated_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.schoolId],
      foreignColumns: [schools.id],
      name: 'packages_school_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.locationGroupId],
      foreignColumns: [locationGroups.id],
      name: 'packages_location_group_id_fkey',
    }).onDelete('restrict'),
    check(
      'packages_status_check',
      sql`status = ANY (ARRAY['active'::text, 'inactive'::text, 'archived'::text])`,
    ),
    pgPolicy('isolate_packages', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid)`,
    }),
  ],
).enableRLS();

export const packagePurchases = pgTable(
  'package_purchases',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),

    schoolId: uuid('school_id').notNull(),
    studentId: uuid('student_id').notNull(),
    packageId: uuid('package_id').notNull(),

    purchasedMinutes: integer('purchased_minutes').notNull(),

    totalAmount: numeric('total_amount', {
      precision: 10,
      scale: 2,
    }).notNull(),

    currency: text().default('aud').notNull(),

    status: text().default('pending').notNull(),

    paidAt: timestamp('paid_at', {
      withTimezone: true,
      mode: 'string',
    }),

    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
  },
  (table) => [
    index('idx_package_purchases_school_id').on(table.schoolId),
    index('idx_package_purchases_student_id').on(table.studentId),

    foreignKey({
      columns: [table.schoolId],
      foreignColumns: [schools.id],
      name: 'package_purchases_school_id_fkey',
    }).onDelete('restrict'),

    foreignKey({
      columns: [table.studentId],
      foreignColumns: [students.id],
      name: 'package_purchases_student_id_fkey',
    }).onDelete('restrict'),

    foreignKey({
      columns: [table.packageId],
      foreignColumns: [packages.id],
      name: 'package_purchases_package_id_fkey',
    }).onDelete('restrict'),

    check(
      'package_purchases_status_check',
      sql`status = ANY (
        ARRAY[
          'pending'::text,
          'paid'::text,
          'failed'::text,
          'expired'::text
        ]
      )`,
    ),

    check('package_purchases_minutes_check', sql`purchased_minutes > 0`),

    pgPolicy('isolate_package_purchases', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`school_id = (
        NULLIF(
          current_setting('app.current_school_id'::text, true),
          ''
        )
      )::uuid`,
    }),
  ],
).enableRLS();
