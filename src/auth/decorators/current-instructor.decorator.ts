import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator, InternalServerErrorException } from '@nestjs/common';

import type { RequestWithAuth } from '../interfaces/auth.interface';

export const CurrentInstructorId = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<RequestWithAuth>();

  if (!request.instructorId) {
    throw new InternalServerErrorException(
      'instructorId is not set. Make sure RolesGuard is applied.',
    );
  }

  return request.instructorId;
});
