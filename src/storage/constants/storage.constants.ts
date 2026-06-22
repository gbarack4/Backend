import { MaxFileSizeValidator, ParseFilePipe } from '@nestjs/common';

export const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
export const MAX_PRESIGNED_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

export const fileValidationPipe = new ParseFilePipe({
  validators: [
    new MaxFileSizeValidator({ maxSize: MAX_PRESIGNED_UPLOAD_BYTES }),
  ],
});
