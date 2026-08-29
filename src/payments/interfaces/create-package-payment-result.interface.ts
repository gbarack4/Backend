import type Stripe from 'stripe';

export interface CreatePackagePaymentResult {
  bookingId: string;
  packagePurchaseId: string;
  paymentIntentId: string;
  clientSecret: string | null;
  stripeAccountId: string;
  status: Stripe.PaymentIntent.Status;
  expiresAt: string;
}
