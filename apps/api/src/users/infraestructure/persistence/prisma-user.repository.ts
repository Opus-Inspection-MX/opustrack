import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { UserRepository } from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';
import { handlePrismaError } from '../../../shared/infrastructure/prisma/prisma-exceptions.mapper';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: User): Promise<void> {
    try {
      await this.prisma.user.create({
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          password: user.password!,
          roleId: user.roleId!,
          userStatusId: user.userStatusId!,
          vicId: user.vicId ?? undefined,
          active: user.active ?? true,
        },
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async findAll(): Promise<User[]> {
    try {
      const users = await this.prisma.user.findMany();
      return users.map(
        (u) =>
          new User(
            u.id,
            u.name,
            u.email,
            u.password ?? undefined,
            u.roleId,
            u.userStatusId,
            u.vicId ?? undefined,
            u.active,
          ),
      );
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async findById(id: string): Promise<User | null> {
    try {
      const u = await this.prisma.user.findUnique({ where: { id } });
      return u
        ? new User(
            u.id,
            u.name,
            u.email,
            u.password ?? undefined,
            u.roleId,
            u.userStatusId,
            u.vicId ?? undefined,
            u.active,
          )
        : null;
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user
      ? new User(
          user.id,
          user.name,
          user.email,
          user.password ?? undefined,
          user.roleId,
          user.userStatusId,
          user.vicId ?? undefined,
          user.active,
        )
      : null;
  }

  async delete(id: string): Promise<User | null> {
    const userToDelete = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!userToDelete) return null;

    await this.prisma.user.delete({
      where: { id },
    });

    return new User(
      userToDelete.id,
      userToDelete.name,
      userToDelete.email,
      userToDelete.password ?? undefined,
      userToDelete.roleId,
      userToDelete.userStatusId,
      userToDelete.vicId ?? undefined,
      userToDelete.active,
    );
  }

  async update(user: User): Promise<User | null> {
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        name: user.name,
        email: user.email,
        password: user.password,
        roleId: user.roleId!,
        userStatusId: user.userStatusId!,
        vicId: user.vicId ?? undefined,
        active: user.active ?? true,
      },
    });
    return new User(
      updatedUser.id,
      updatedUser.name,
      updatedUser.email,
      updatedUser.password ?? undefined,
      updatedUser.roleId,
      updatedUser.userStatusId,
      updatedUser.vicId ?? undefined,
      updatedUser.active,
    );
  }
}
