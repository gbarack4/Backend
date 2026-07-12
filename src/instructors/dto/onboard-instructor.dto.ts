import { IsString, IsOptional, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

class AddressDto {
  @IsString()
  line1!: string;

  @IsString()
  @IsOptional()
  line2?: string | null;

  @IsString()
  suburb!: string;

  @IsString()
  state!: string;

  @IsString()
  postcode!: string;
}

class DocumentsDto {
  @IsString()
  driverLicence!: string;

  @IsString()
  instructorAccreditation!: string;

  @IsString()
  insuranceCertificate!: string;

  @IsString()
  vehicleRegistration!: string;

  @IsString()
  @IsOptional()
  workingWithChildrenCheck?: string | null;

  @IsString()
  @IsOptional()
  policeCheck?: string | null;
}

export class OnboardInstructorDto {
  @IsString()
  @IsOptional()
  profilePhotoUri?: string | null;

  @IsString()
  @IsOptional()
  profilePhotoName?: string | null;

  @IsString()
  dateOfBirth!: string;

  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;

  @IsString()
  emergencyContactName!: string;

  @IsString()
  emergencyContactPhone!: string;

  @IsString()
  driverLicenceNumber!: string;

  @IsString()
  driverLicenceExpiry!: string;

  @IsString()
  instructorAccreditationNumber!: string;

  @IsString()
  accreditationExpiry!: string;

  @IsString()
  yearsOfExperience!: string;

  @IsIn(['automatic', 'manual', 'both'])
  transmissionType!: string;

  @IsString()
  languagesSpoken!: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsString()
  vehicleMake!: string;

  @IsString()
  vehicleModel!: string;

  @IsString()
  vehicleYear!: string;

  @IsString()
  registrationNumber!: string;

  @IsIn(['automatic', 'manual'])
  vehicleTransmission!: string;

  @IsIn(['yes', 'no'])
  dualControlVehicle!: string;

  @ValidateNested()
  @Type(() => DocumentsDto)
  documents!: DocumentsDto;
}
