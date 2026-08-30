import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';

import type { RequestWithAuth } from '../interfaces/auth.interface';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<RequestWithAuth>();
  return request.currentUser;
});
