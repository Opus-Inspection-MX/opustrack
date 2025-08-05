import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());
  const devOrigin = process.env.DEV_ORIGIN || 'http://localhost:3000';
  const prodOrigin =
    process.env.PROD_ORIGIN || 'https://opustrack.abdielreyes.com';

  app.enableCors({
    origin: process.env.NODE_ENV === 'production' ? prodOrigin : devOrigin, // tu front‑end
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true, // si envías cookies / auth
    allowedHeaders: 'Content-Type,Authorization',
  });
  app.setGlobalPrefix('api'); // opcional, si quieres un prefijo global
  await app.listen(8000);
}
bootstrap();
