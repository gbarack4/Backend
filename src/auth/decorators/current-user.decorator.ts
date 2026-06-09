import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithAuth } from '../interfaces/auth.interface';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithAuth>();
    return request.currentUser;
  },
);
