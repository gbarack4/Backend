import {
  pgTable,
  foreignKey,
  unique,
  check,
  uuid,
  text,
  timestamp,
  pgPolicy,
  numeric,
  index,
  integer,
  time,
  boolean,
  jsonb,
  date,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

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
    unique('instructor_schools_instructor_id_school_id_key').on(
      table.instructorId,
      table.schoolId,
    ),
    check(
      'instructor_schools_status_check',
      sql`status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'blocked'::text])`,
    ),
    check(
      'instructor_schools_source_check',
      sql`source = ANY (ARRAY['instructor_request'::text, 'school_invite'::text])`,
    ),
  ],
).enableRLS();

export const locations = pgTable(
  'locations',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    schoolId: uuid('school_id').notNull(),
    name: text().notNull(),
    address: text(),
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
    subscriptionStatus: text('subscription_status')
      .default('trialing')
      .notNull(),
    trialEndsAt: timestamp('trial_ends_at', {
      withTimezone: true,
      mode: 'string',
    }),

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
    unique('school_users_user_id_school_id_key').on(
      table.userId,
      table.schoolId,
    ),
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
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
  },
  (table) => [
    index('idx_students_school_id').using(
      'btree',
      table.schoolId.asc().nullsLast().op('uuid_ops'),
    ),
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
    check(
      'instructors_status_check',
      sql`status = ANY (ARRAY['active'::text, 'inactive'::text])`,
    ),
  ],
).enableRLS();

export const availability = pgTable(
  'availability',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    instructorId: uuid('instructor_id').notNull(),
    dayOfWeek: integer('day_of_week').notNull(),
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
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
    check(
      'availability_day_of_week_check',
      sql`(day_of_week >= 0) AND (day_of_week <= 6)`,
    ),
  ],
);

export const users = pgTable(
  'users',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    clerkUserId: text('clerk_user_id').notNull(),
    email: text().notNull(),
    role: text().notNull(),
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
    check(
      'users_role_check',
      sql`role = ANY (ARRAY['owner'::text, 'admin'::text, 'staff'::text, 'instructor'::text, 'student'::text])`,
    ),
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
    serviceId: uuid('service_id').notNull(),
    locationId: uuid('location_id'),
    startDatetime: timestamp('start_datetime', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    endDatetime: timestamp('end_datetime', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    status: text().default('pending').notNull(),
    totalPrice: numeric('total_price', { precision: 10, scale: 2 }),
    notes: text(),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
  },
  (table) => [
    index('idx_bookings_instructor_id').using(
      'btree',
      table.instructorId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_bookings_school_id').using(
      'btree',
      table.schoolId.asc().nullsLast().op('uuid_ops'),
    ),
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
      columns: [table.serviceId],
      foreignColumns: [services.id],
      name: 'bookings_service_id_fkey',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.locationId],
      foreignColumns: [locations.id],
      name: 'bookings_location_id_fkey',
    }).onDelete('set null'),
    pgPolicy('isolate_bookings', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid)`,
    }),
    check(
      'bookings_status_check',
      sql`status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text])`,
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
    check(
      'notifications_status_check',
      sql`status = ANY (ARRAY['unread'::text, 'read'::text])`,
    ),
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
    bookingId: uuid('booking_id').notNull(),
    amount: numeric({ precision: 10, scale: 2 }).notNull(),
    method: text(),
    status: text().notNull(),
    transactionRef: text('transaction_ref'),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.bookingId],
      foreignColumns: [bookings.id],
      name: 'payments_booking_id_fkey',
    }).onDelete('cascade'),
    pgPolicy('isolate_payments', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`(booking_id IN ( SELECT bookings.id
   FROM bookings
  WHERE (bookings.school_id = (NULLIF(current_setting('app.current_school_id'::text, true), ''::text))::uuid)))`,
    }),
    check(
      'payments_status_check',
      sql`status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'refunded'::text])`,
    ),
  ],
);

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
    check(
      'school_domains_type_check',
      sql`type = ANY (ARRAY['subdomain'::text, 'custom'::text])`,
    ),

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
