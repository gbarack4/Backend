import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'require_permission';

export const RequirePermission = (permission: 'view' | 'edit') =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permission);
