import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { LoginUserUseCase } from '../../application/use-cases/login-user.use-case';
import { LoginDto } from '../dtos/login.dto';
import { JwtAuthGuard } from '../../infrastructure/security/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly loginUseCase: LoginUserUseCase) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.loginUseCase.execute(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me')
  me(@Request() req) {
    return req.user;
  }
}
