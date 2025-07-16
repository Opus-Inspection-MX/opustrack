import { User } from '../entities/user.entity';

export interface UserRepository {
  create(user: User): Promise<void>;
  findAll(): Promise<User[]>;
  findByEmail(email: string): Promise<User | null>;
}
