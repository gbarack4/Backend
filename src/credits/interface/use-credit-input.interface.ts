export interface UseCreditInput {
  schoolId: string;
  studentId: string;
  minutes: number;
  bookingId: string;
  idempotencyKey: string;
}
