import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());

  app.enableCors({
    origin: 'http://localhost:3000', // tu front‑end
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true, // si envías cookies / auth
    allowedHeaders: 'Content-Type,Authorization',
  });
  app.setGlobalPrefix('api'); // opcional, si quieres un prefijo global
  await app.listen(process.env.PORT ?? 8000);
}
bootstrap();
