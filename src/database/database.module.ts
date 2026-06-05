import { Global, Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from './schema';
import * as path from 'node:path';

export const DB_CONNECTION = 'DB_CONNECTION' as const;

@Global()
@Module({
  providers: [
    {
      provide: DB_CONNECTION,
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger(DatabaseModule.name);
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

        const db = drizzle(pool, { schema });

        try {
          logger.log('Starting database migrations...');
          await migrate(db, {
            migrationsFolder: path.join(__dirname, 'migrations'),
          });
          logger.log('Migrations applied successfully!');
        } catch (error) {
          logger.error('Failed to apply migrations', error);
          throw error;
        }
        return db;
      },
      inject: [ConfigService],
    },
  ],
  exports: [DB_CONNECTION],
})
export class DatabaseModule {}
