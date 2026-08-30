import type { AddCreditType } from '../types/add-credit-type.type';

export interface AddCreditInput {
  schoolId: string;
  studentId: string;
  minutes: number;
  type: AddCreditType;
  idempotencyKey: string;
  packagePurchaseId?: string | null;
  bookingId?: string | null;
}
