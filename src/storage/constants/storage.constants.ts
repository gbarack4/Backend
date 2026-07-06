import { MaxFileSizeValidator, ParseFilePipe } from '@nestjs/common';

export const ALLOWED_FILE_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
} as const;

export type AllowedExtension = keyof typeof ALLOWED_FILE_TYPES;

export const MAX_PRESIGNED_UPLOAD_BYTES = 5 * 1024 * 1024;
export const PRESIGNED_URL_TTL_SECONDS = 300;

export const fileValidationPipe = new ParseFilePipe({
  validators: [
    new MaxFileSizeValidator({ maxSize: MAX_PRESIGNED_UPLOAD_BYTES }),
  ],
});
