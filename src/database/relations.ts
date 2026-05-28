import { relations } from 'drizzle-orm/relations';
import {
  instructors,
  instructorSchools,
  schools,
  locations,
  services,
  users,
  schoolUsers,
  students,
  availability,
  availabilityBlocks,
  bookings,
  bookingForms,
  formFields,
  fieldOptions,
  pricingRules,
  invoices,
  notifications,
  invites,
  reviews,
  coupons,
  payments,
  activityLogs,
} from './schema';

export const instructorSchoolsRelations = relations(
  instructorSchools,
  ({ one }) => ({
    instructor: one(instructors, {
      fields: [instructorSchools.instructorId],
      references: [instructors.id],
    }),
    school: one(schools, {
      fields: [instructorSchools.schoolId],
      references: [schools.id],
    }),
  }),
);

export const instructorsRelations = relations(instructors, ({ one, many }) => ({
  instructorSchools: many(instructorSchools),
  user: one(users, {
    fields: [instructors.userId],
    references: [users.id],
  }),
  availabilities: many(availability),
  availabilityBlocks: many(availabilityBlocks),
  bookings: many(bookings),
  reviews: many(reviews),
}));

export const schoolsRelations = relations(schools, ({ many }) => ({
  instructorSchools: many(instructorSchools),
  locations: many(locations),
  services: many(services),
  schoolUsers: many(schoolUsers),
  students: many(students),
  bookings: many(bookings),
  bookingForms: many(bookingForms),
  invoices: many(invoices),
  invites: many(invites),
  coupons: many(coupons),
  activityLogs: many(activityLogs),
}));

export const locationsRelations = relations(locations, ({ one, many }) => ({
  school: one(schools, {
    fields: [locations.schoolId],
    references: [schools.id],
  }),
  bookings: many(bookings),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  school: one(schools, {
    fields: [services.schoolId],
    references: [schools.id],
  }),
  bookings: many(bookings),
  bookingForms: many(bookingForms),
}));

export const schoolUsersRelations = relations(schoolUsers, ({ one }) => ({
  user: one(users, {
    fields: [schoolUsers.userId],
    references: [users.id],
  }),
  school: one(schools, {
    fields: [schoolUsers.schoolId],
    references: [schools.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  schoolUsers: many(schoolUsers),
  students: many(students),
  instructors: many(instructors),
  notifications: many(notifications),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  school: one(schools, {
    fields: [students.schoolId],
    references: [schools.id],
  }),
  user: one(users, {
    fields: [students.userId],
    references: [users.id],
  }),
  bookings: many(bookings),
  invoices: many(invoices),
  reviews: many(reviews),
}));

export const availabilityRelations = relations(availability, ({ one }) => ({
  instructor: one(instructors, {
    fields: [availability.instructorId],
    references: [instructors.id],
  }),
}));

export const availabilityBlocksRelations = relations(
  availabilityBlocks,
  ({ one }) => ({
    instructor: one(instructors, {
      fields: [availabilityBlocks.instructorId],
      references: [instructors.id],
    }),
  }),
);

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  school: one(schools, {
    fields: [bookings.schoolId],
    references: [schools.id],
  }),
  student: one(students, {
    fields: [bookings.studentId],
    references: [students.id],
  }),
  instructor: one(instructors, {
    fields: [bookings.instructorId],
    references: [instructors.id],
  }),
  service: one(services, {
    fields: [bookings.serviceId],
    references: [services.id],
  }),
  location: one(locations, {
    fields: [bookings.locationId],
    references: [locations.id],
  }),
  invoices: many(invoices),
  reviews: many(reviews),
  payments: many(payments),
}));

export const bookingFormsRelations = relations(
  bookingForms,
  ({ one, many }) => ({
    school: one(schools, {
      fields: [bookingForms.schoolId],
      references: [schools.id],
    }),
    service: one(services, {
      fields: [bookingForms.serviceId],
      references: [services.id],
    }),
    formFields: many(formFields),
  }),
);

export const formFieldsRelations = relations(formFields, ({ one, many }) => ({
  bookingForm: one(bookingForms, {
    fields: [formFields.formId],
    references: [bookingForms.id],
  }),
  fieldOptions: many(fieldOptions),
  pricingRules: many(pricingRules),
}));

export const fieldOptionsRelations = relations(fieldOptions, ({ one }) => ({
  formField: one(formFields, {
    fields: [fieldOptions.fieldId],
    references: [formFields.id],
  }),
}));

export const pricingRulesRelations = relations(pricingRules, ({ one }) => ({
  formField: one(formFields, {
    fields: [pricingRules.fieldId],
    references: [formFields.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  school: one(schools, {
    fields: [invoices.schoolId],
    references: [schools.id],
  }),
  student: one(students, {
    fields: [invoices.studentId],
    references: [students.id],
  }),
  booking: one(bookings, {
    fields: [invoices.bookingId],
    references: [bookings.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const invitesRelations = relations(invites, ({ one }) => ({
  school: one(schools, {
    fields: [invites.schoolId],
    references: [schools.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  booking: one(bookings, {
    fields: [reviews.bookingId],
    references: [bookings.id],
  }),
  student: one(students, {
    fields: [reviews.studentId],
    references: [students.id],
  }),
  instructor: one(instructors, {
    fields: [reviews.instructorId],
    references: [instructors.id],
  }),
}));

export const couponsRelations = relations(coupons, ({ one }) => ({
  school: one(schools, {
    fields: [coupons.schoolId],
    references: [schools.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  booking: one(bookings, {
    fields: [payments.bookingId],
    references: [bookings.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  school: one(schools, {
    fields: [activityLogs.schoolId],
    references: [schools.id],
  }),
}));
