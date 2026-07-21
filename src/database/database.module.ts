import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export const DB_CONNECTION = 'DB_CONNECTION' as const;

@Global()
@Module({
  providers: [
    {
      provide: DB_CONNECTION,
      useFactory: (configService: ConfigService) => {
        let connectionString = configService.get<string>('DATABASE_URL');

        if (!connectionString) {
          throw new Error('DATABASE_URL is missing in environment variables');
        }

        if (connectionString?.includes('?')) {
          connectionString = connectionString.split('?')[0];
        }

        const isLocal =
          connectionString.includes('localhost') ||
          connectionString.includes('127.0.0.1');

        const pool = new Pool({
          connectionString,
          ssl: isLocal ? false : { rejectUnauthorized: false },
        });

        return drizzle(pool, { schema });
      },
      inject: [ConfigService],
    },
  ],
  exports: [DB_CONNECTION],
})
export class DatabaseModule {}
