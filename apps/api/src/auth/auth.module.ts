import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { AuthController } from './presentation/controllers/auth.controller';
import { LoginUserUseCase } from './application/use-cases/login-user.use-case';
import { BcryptService } from './infrastructure/security/bcrypt.service';
import { JwtStrategy } from './infrastructure/security/jwt.strategy';
import { JwtAuthGuard } from './infrastructure/security/jwt-auth.guard';
import { JwtTokenService } from './infrastructure/token/jwt-token.service';
import { PrismaAuthRepository } from './infrastructure/persistence/prisma-auth.repository';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    UsersModule,
    SharedModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '2h' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    LoginUserUseCase,
    BcryptService,
    JwtStrategy,
    JwtAuthGuard,
    JwtTokenService,

    PrismaAuthRepository,
  ],
})
export class AuthModule {}
