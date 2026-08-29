export interface CreateStripePaymentIntentInput {
  bookingId: string;
  studentId: string;
  schoolId: string;
  packageId: string;
  packageName: string;
  packagePurchaseId: string;
  totalAmount: string;
  currency: string;
  expiresAt: string;
  stripeAccountId: string;
}
