import {
  IsString,
  IsInt,
  IsOptional,
  IsNotEmpty,
  IsDate,
  IsBoolean,
} from 'class-validator';

export class CreateWorkOrderDto {
  @IsNotEmpty({ message: 'El ID del incidente es obligatorio.' })
  @IsInt({ message: 'El ID del incidente debe ser un número.' })
  incidentId: number;

  @IsNotEmpty({ message: 'El ID del usuario asignado es obligatorio.' })
  @IsString({ message: 'El ID del usuario asignado debe ser una cadena.' })
  assignedToId: string;

  @IsNotEmpty({ message: 'El estado es obligatorio.' })
  @IsString({ message: 'El estado debe ser una cadena.' })
  status: string;

  @IsOptional()
  @IsString({ message: 'Las notas deben ser una cadena.' })
  notes?: string;

  @IsOptional()
  @IsDate({ message: 'La fecha de inicio debe ser una fecha válida.' })
  startedAt?: Date;

  @IsOptional()
  @IsDate({ message: 'La fecha de finalización debe ser una fecha válida.' })
  finishedAt?: Date;

  @IsOptional()
  @IsBoolean({ message: 'El campo activo debe ser booleano.' })
  active?: boolean;
}
