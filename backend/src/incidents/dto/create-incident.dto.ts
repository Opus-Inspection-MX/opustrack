import { IsString, IsInt, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateIncidentDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsInt()
  priority: number;

  @IsInt()
  sla: number;

  @IsOptional()
  @IsInt()
  typeId?: number;

  @IsOptional()
  @IsInt()
  statusId?: number;

  @IsOptional()
  reportedAt?: Date;

  @IsOptional()
  resolvedAt?: Date;

  @IsOptional()
  @IsString()
  vicId?: string;

  @IsOptional()
  @IsString()
  reportedById?: string;

  @IsOptional()
  @IsString()
  scheduleId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  active?: boolean;
}
