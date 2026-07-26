import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@/database/schema';
import { eq } from 'drizzle-orm';
import { DB_CONNECTION } from '@/database/database.module';

const logger = new Logger('Bootstrap');

const MAX_CACHE_SIZE = 1000;
const CACHE_TTL_MS = 5 * 60_000;
const NEGATIVE_CACHE_TTL_MS = 30_000;

const domainCache = new Map<string, { valid: boolean; expiresAt: number }>();
const inFlightChecks = new Map<string, Promise<boolean>>();

async function isCustomDomainAllowed(
  db: NodePgDatabase<typeof schema>,
  hostname: string,
): Promise<boolean> {
  if (hostname.length > 255) {
    return false;
  }

  const now = Date.now();
  const cached = domainCache.get(hostname);

  if (cached) {
    if (cached.expiresAt <= now) {
      domainCache.delete(hostname);
    } else {
      domainCache.delete(hostname);
      domainCache.set(hostname, cached);
      return cached.valid;
    }
  }

  if (inFlightChecks.has(hostname)) {
    return inFlightChecks.get(hostname)!;
  }

  const checkPromise = (async () => {
    try {
      const [domainRecord] = await db
        .select({ domain: schema.schoolDomains.domain })
        .from(schema.schoolDomains)
        .where(eq(schema.schoolDomains.domain, hostname))
        .limit(1);

      const valid = !!domainRecord;

      if (domainCache.size >= MAX_CACHE_SIZE) {
        const currentTime = Date.now();
        for (const [key, value] of domainCache) {
          if (value.expiresAt <= currentTime) {
            domainCache.delete(key);
          }
        }
        if (domainCache.size >= MAX_CACHE_SIZE) {
          const [oldestKey] = domainCache.keys();
          if (oldestKey) domainCache.delete(oldestKey);
        }
      }

      const ttl = valid ? CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS;

      domainCache.set(hostname, {
        valid,
        expiresAt: Date.now() + ttl,
      });
      return valid;
    } catch (error) {
      const err = error as Error;
      logger.error(`DB Error during CORS check for ${hostname}`, err.stack);
      return false;
    } finally {
      inFlightChecks.delete(hostname);
    }
  })();

  inFlightChecks.set(hostname, checkPromise);
  return checkPromise;
}

async function bootstrap() {
  const isProd = process.env.NODE_ENV === 'production';

  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: isProd
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.use(helmet());
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const db = app.get<NodePgDatabase<typeof schema>>(DB_CONNECTION);

  const envOrigins =
    process.env.ALLOWED_ORIGINS?.split(',')
      .map((o) => o.trim().toLowerCase())
      .filter(Boolean) ?? [];

  app.enableCors({
    origin: async (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = origin.toLowerCase();
      let hostname: string | undefined;

      try {
        hostname = new URL(normalizedOrigin).hostname;
      } catch {
        // If origin is not a valid URL (e.g. capacitor://), hostname will be undefined
      }

      const isStaticAllowed = [
        /^http:\/\/([a-z0-9-]+\.)?localhost:3002$/,
        /^https:\/\/([a-z0-9-]+\.)?driveinstructor\.pro$/,
      ].some((regex) => regex.test(normalizedOrigin));

      if (isStaticAllowed || envOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      if (hostname) {
        const isAllowed = await isCustomDomainAllowed(db, hostname);
        if (isAllowed) {
          return callback(null, true);
        }
      }

      logger.warn(`Blocked CORS request from origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'), false);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization,x-school-id',
    credentials: true,
  });

  if (!isProd) {
    const config = new DocumentBuilder()
      .setTitle('DrivingInstructor.pro API')
      .setDescription('API documentation for Driving School SaaS')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const documentFactory = () => SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, documentFactory);
  }

  const port = Number(process.env.PORT) || 8000;
  await app.listen(port, '0.0.0.0');
}

bootstrap().catch((error: unknown) => {
  const err = error as Error;
  logger.error('Failed to bootstrap the application', err.stack);
  process.exit(1);
});
