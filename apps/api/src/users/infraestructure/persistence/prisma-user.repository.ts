import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { UserRepository } from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';
import { handlePrismaError } from '../../../../prisma/prisma-exceptions.mapper';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: User): Promise<void> {
    try {
      await this.prisma.user.create({
        data: {
          name: user.name,
          email: user.email,
          password: user.password!,
          usertype_id: user.usertype_id!,
        },
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async findAll(): Promise<User[]> {
    try {
      const users = await this.prisma.user.findMany();
      return users.map((u) => new User(u.id, u.name, u.email));
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async findById(id: string): Promise<User | null> {
    try {
      return await this.prisma.user.findUnique({ where: { id } });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user ? new User(user.id, user.name, user.email) : null;
  }

  async delete(id: string): Promise<User | null> {
    const userToDelete = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!userToDelete) return null;

    await this.prisma.user.delete({
      where: { id },
    });

    return new User(userToDelete.id, userToDelete.name, userToDelete.email);
  }

  async update(user: User): Promise<User | null> {
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        name: user.name,
        email: user.email,
        password: user.password,
        usertype_id: user.usertype_id,
      },
    });

    return new User(updatedUser.id, updatedUser.name, updatedUser.email);
  }
}
