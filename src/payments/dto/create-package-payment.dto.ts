import { IsUUID } from 'class-validator';

export class CreatePackagePaymentDto {
  @IsUUID('4')
  bookingId!: string;
}
