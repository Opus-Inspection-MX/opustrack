import { Injectable, Inject } from '@nestjs/common';
import { UserRepository } from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';
import { UserAlreadyExistsError } from 'src/users/domain/errors/user-existance.errors';

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject('UserRepository') private readonly userRepo: UserRepository,
  ) {}

  async execute(name: string, email: string, password: string): Promise<User> {
    const exists = await this.userRepo.findByEmail(email);
    if (exists) throw new UserAlreadyExistsError(email);

    const user = new User(name, email, password);
    await this.userRepo.create(user);
    return user;
  }
}
