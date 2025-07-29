import { Injectable, Inject } from '@nestjs/common';
import { UserRepository } from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';
import {
  UserNotFoundError,
  UserAlreadyExistsError,
} from '../../domain/errors/user-existance.errors';
import {
  RoleNotFoundError,
  UserStatusNotFoundError,
  VehicleInspectionCenterNotFoundError,
} from '../../domain/errors/user-update.errors';

@Injectable()
export class UpdateUserUseCase {
  constructor(
    @Inject('UserRepository') private readonly userRepo: UserRepository,
  ) {}

  async execute(id: string, updateData: Partial<User>): Promise<User> {
    const user = await this.userRepo.findById(id);
    if (!user) throw new UserNotFoundError(id);
    // Check for email uniqueness
    if (updateData.email && updateData.email !== user.email) {
      const existing = await this.userRepo.findByEmail(updateData.email);
      if (existing && existing.id !== id)
        throw new UserAlreadyExistsError(updateData.email);
    }
    // Check for role existence
    if (
      updateData.roleId &&
      typeof this.userRepo['roleExists'] === 'function'
    ) {
      const exists = await this.userRepo['roleExists'](updateData.roleId);
      if (!exists) throw new RoleNotFoundError(updateData.roleId);
    }
    // Check for userStatus existence
    if (
      updateData.userStatusId &&
      typeof this.userRepo['userStatusExists'] === 'function'
    ) {
      const exists = await this.userRepo['userStatusExists'](
        updateData.userStatusId,
      );
      if (!exists) throw new UserStatusNotFoundError(updateData.userStatusId);
    }
    // Check for VIC existence
    if (updateData.vicId && typeof this.userRepo['vicExists'] === 'function') {
      const exists = await this.userRepo['vicExists'](updateData.vicId);
      if (!exists)
        throw new VehicleInspectionCenterNotFoundError(updateData.vicId);
    }
    // Create a new User entity with updated fields
    const updated = new User(
      id,
      updateData.name ?? user.name,
      updateData.email ?? user.email,
      updateData.password ?? user.password,
      updateData.roleId ?? user.roleId,
      updateData.userStatusId ?? user.userStatusId,
      updateData.vicId ?? user.vicId,
      updateData.active ?? user.active,
    );
    const result = await this.userRepo.update(updated);
    if (!result) throw new UserNotFoundError(id);
    return result;
  }
}
