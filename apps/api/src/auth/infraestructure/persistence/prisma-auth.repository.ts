// filepath: auth/infraestructure/persistence/prisma-auth.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infraestructure/prisma/prisma.service';
import { AuthRepository } from 'src/auth/domain/repositories/auth.repository';
import { User } from '../../../users/domain/entities/user.entity';

@Injectable()
export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    const u = await this.prisma.user.findUnique({ where: { email } });
    if (!u) return null;
    return new User(
      u.id,
      u.name,
      u.email,
      u.password,
      u.roleId,
      u.userStatusId,
      u.vicId ?? undefined,
      u.active,
      u.refreshToken ?? undefined,
    );
  }

  async findById(id: string): Promise<User | null> {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) return null;
    return new User(
      u.id,
      u.name,
      u.email,
      u.password,
      u.roleId,
      u.userStatusId,
      u.vicId ?? undefined,
      u.active,
      u.refreshToken ?? undefined,
    );
  }

  async saveRefreshToken(userId: string, refreshToken: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken },
    });
  }

  async removeRefreshToken(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }
}
