import * as relations from './relations';
import * as schema from './schema';

export const fullSchema = { ...schema, ...relations };
export type FullSchema = typeof fullSchema;
