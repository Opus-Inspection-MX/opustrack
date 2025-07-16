import { Module } from '@nestjs/common';
import { UsersController } from './presentation/users.controller';
import { PrismaUserRepository } from './infraestructure/persistence/prisma-user.repository';
import { PrismaService } from 'prisma/prisma.service';

@Module({
  controllers: [UsersController],
  providers: [
    {
      provide: 'UserRepository',
      useClass: PrismaUserRepository,
    },
    PrismaService,
  ],
})
export class UsersModule {}
