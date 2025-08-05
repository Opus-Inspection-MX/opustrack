import { Module } from '@nestjs/common';
import { UsersController } from './presentation/users.controller';
import { PrismaUserRepository } from './infraestructure/persistence/prisma-user.repository';
import { PrismaService } from '../shared/infrastructure/prisma/prisma.service';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case';
import { FindUserUseCase } from './application/use-cases/find-user.use-case';
import { UpdateUserUseCase } from './application/use-cases/update-user.use-case';
import { DeleteUserUseCase } from './application/use-cases/delete-user.use-case';
import { ActivateUserUseCase } from './application/use-cases/activate-user.use-case';
import { DeactivateUserUseCase } from './application/use-cases/deactivate-user.use-case';

@Module({
  controllers: [UsersController],
  providers: [
    {
      provide: 'UserRepository',
      useClass: PrismaUserRepository,
    },
    PrismaService,
    CreateUserUseCase,
    FindUserUseCase,
    UpdateUserUseCase,
    DeleteUserUseCase,
    ActivateUserUseCase,
    DeactivateUserUseCase,
  ],
  exports: ['UserRepository'],
})
export class UsersModule {}
