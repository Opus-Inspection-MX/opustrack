//create the repository interface for authentication
import { User } from 'src/users/domain/entities/user.entity';
export interface AuthRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  saveRefreshToken(userId: string, refreshToken: string): Promise<void>;
  removeRefreshToken(userId: string): Promise<void>;
}
