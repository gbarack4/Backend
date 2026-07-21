import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const envOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : [];

  const allowedOrigins = [
    /^http:\/\/[a-z0-9-]+\.localhost:3002$/,
    'http://localhost:3002',
    /^https:\/\/[a-z0-9-]+\.driveinstructor\.pro$/,
    'https://driveinstructor.pro',
    ...envOrigins,
  ];

  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization,x-school-id',
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('DrivingInstructor.pro API')
    .setDescription('API documentation for Driving School SaaS')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  const port = process.env.PORT || 8000;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
