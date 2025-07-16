import { UserRepository } from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';

export class CreateUserUseCase {
  constructor(private readonly userRepo: UserRepository) {}

  async execute(name: string, email: string): Promise<User> {
    const exists = await this.userRepo.findByEmail(email);
    if (exists) throw new Error('Email already in use');

    const user = new User(Date.now().toString(), name, email);
    await this.userRepo.create(user);
    return user;
  }
}
