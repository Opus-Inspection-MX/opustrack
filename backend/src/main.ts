import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());
  //cors for * origin
  app.enableCors({
    origin: [
      'https://opustrack.abdielreyes.com',
      'https://opustrack.internal.abdielreyes.com',
      'http://localhost:3000',
    ],
    allowedHeaders: 'Content-Type, Accept, Authorization',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  app.setGlobalPrefix('api'); // opcional, si quieres un prefijo global
  await app.listen(8000);
}
bootstrap();
