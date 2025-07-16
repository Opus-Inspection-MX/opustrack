import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { CreateUserDto } from '../presentation/dtos/create-user.dto';
import { CreateUserUseCase } from '../application/use-cases/create-user.use-case';
import { UserRepository } from '../domain/repositories/user.repository';

@Controller('users')
export class UsersController {
  constructor(@Inject('UserRepository') private userRepo: UserRepository) {}

  @Post()
  async create(@Body() dto: CreateUserDto) {
    const useCase = new CreateUserUseCase(this.userRepo);
    return useCase.execute(dto.name, dto.email);
  }

  @Get()
  async findAll() {
    return this.userRepo.findAll();
  }
}
