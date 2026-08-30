import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type { FullSchema } from '@/database/database.types';

export type DatabaseTransaction = Parameters<
  Parameters<NodePgDatabase<FullSchema>['transaction']>[0]
>[0];
