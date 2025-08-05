import { Injectable, Inject } from '@nestjs/common';
import { UserRepository } from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';
import { UserNotFoundError } from '../../domain/errors/user-existance.errors';
import { UserAlreadyInactiveError } from '../../domain/errors/user-activation.errors';

@Injectable()
export class DeactivateUserUseCase {
  constructor(
    @Inject('UserRepository') private readonly userRepo: UserRepository,
  ) {}

  async execute(id: string): Promise<User> {
    const user = await this.userRepo.findById(id);
    if (!user) throw new UserNotFoundError(id);
    if (!user.active) throw new UserAlreadyInactiveError(id);
    const updated = new User(
      user.id,
      user.name,
      user.email,
      user.password,
      user.roleId,
      user.userStatusId,
      user.vicId,
      false,
    );
    const result = await this.userRepo.update(updated);
    if (!result) throw new UserNotFoundError(id);
    return result;
  }
}
