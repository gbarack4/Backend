import * as schema from '@/database/schema';

export type PaymentRecord = typeof schema.payments.$inferSelect;
