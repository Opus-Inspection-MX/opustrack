import { UserRepository } from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';
import { UserAlreadyExistsError } from 'src/users/domain/errors/user-already-exists.error';

export class CreateUserUseCase {
  constructor(private readonly userRepo: UserRepository) {}

  async execute(name: string, email: string, password: string): Promise<User> {
    const exists = await this.userRepo.findByEmail(email);
    if (exists) throw new UserAlreadyExistsError(email);

    const user = new User(name, email, password);
    await this.userRepo.create(user);
    return user;
  }
}
