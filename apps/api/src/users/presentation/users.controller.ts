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
} from '@nestjs/common';
import { CreateUserDto } from '../presentation/dtos/create-user.dto';
import { CreateUserUseCase } from '../application/use-cases/create-user.use-case';
import { UserRepository } from '../domain/repositories/user.repository';
import { UserNotFoundError } from '../domain/errors/user-not-found.error';
import { UserAlreadyExistsError } from '../domain/errors/user-already-exists.error';
import { DeleteUserUseCase } from '../application/use-cases/delete-user.use-case';

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
}
