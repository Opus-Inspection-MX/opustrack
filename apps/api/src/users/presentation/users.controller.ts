import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Param,
  BadRequestException,
  NotFoundException,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { CreateUserDto } from '../presentation/dtos/create-user.dto';
import { CreateUserUseCase } from '../application/use-cases/create-user.use-case';
import { UserRepository } from '../domain/repositories/user.repository';
import {
  UserNotFoundError,
  UserAlreadyExistsError,
} from '../domain/errors/user-existance.errors';
import { JwtAuthGuard } from 'src/auth/infrastructure/security/jwt-auth.guard';
import { PermissionsGuard } from 'src/auth/infrastructure/security/permissions.guard';
import { OwnerOrPermissionGuard } from 'src/auth/infrastructure/security/owner-or-permission.guard';
import { Permissions } from 'src/auth/infrastructure/security/permissions.decorator';
import { DeleteUserUseCase } from '../application/use-cases/delete-user.use-case';
import { UpdateUserUseCase } from '../application/use-cases/update-user.use-case';
import { UpdateUserDto } from '../presentation/dtos/update-user.dto';

@Controller('users')
export class UsersController {
  constructor(@Inject('UserRepository') private userRepo: UserRepository) {}

  @Post()
  async create(@Body() dto: CreateUserDto) {
    const useCase = new CreateUserUseCase(this.userRepo);
    try {
      return await useCase.execute(dto.name, dto.email, dto.password);
    } catch (error) {
      if (error instanceof UserAlreadyExistsError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('view_users')
  @Get()
  async findAll() {
    try {
      const users = await this.userRepo.findAll();
      if (!users.length) {
        throw new NotFoundException('No users found');
      }
      return users;
    } catch (error) {
      throw error;
    }
  }
  @UseGuards(JwtAuthGuard, OwnerOrPermissionGuard)
  @Permissions('view_user')
  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const user = await this.userRepo.findById(id);
      if (!user) {
        throw new UserNotFoundError(id);
      }
      return user;
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
  @UseGuards(JwtAuthGuard, OwnerOrPermissionGuard)
  @Permissions('delete_user')
  @Delete(':id')
  async delete(@Param('id') id: string) {
    const useCase = new DeleteUserUseCase(this.userRepo);
    try {
      return await useCase.execute(id);
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
  @UseGuards(JwtAuthGuard, OwnerOrPermissionGuard)
  @Permissions('update_user')
  @Post(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    const useCase = new UpdateUserUseCase(this.userRepo);
    try {
      // Only pass fields that are present in dto
      const updateData = Object.assign({}, dto, { id });
      return await useCase.execute(id, updateData);
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
