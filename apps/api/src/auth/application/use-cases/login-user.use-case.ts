import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { UserRepository } from '../../../users/domain/repositories/user.repository';
import { BcryptService } from '../../infrastructure/security/bcrypt.service';
import { JwtTokenService } from '../../infrastructure/token/jwt-token.service';
import { LoginDto } from '../../presentation/dtos/login.dto';

@Injectable()
export class LoginUserUseCase {
  constructor(
    @Inject('UserRepository')
    private readonly userRepo: UserRepository,
    private readonly bcryptService: BcryptService,
    private readonly tokenService: JwtTokenService,
  ) {}

  async execute(dto: LoginDto): Promise<{ accessToken: string }> {
    const user = await this.userRepo.findByEmail(dto.email);
    if (
      !user ||
      !(await this.bcryptService.compare(dto.password, user.password ?? ''))
    ) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const payload = { sub: user.id, roleId: user.roleId, email: user.email };
    return { accessToken: this.tokenService.sign(payload) };
  }
}
