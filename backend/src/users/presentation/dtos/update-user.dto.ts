import { IsString, IsEmail, IsOptional, IsBoolean } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  vicId?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  roleId?: number;

  @IsOptional()
  userStatusId?: number;
}
