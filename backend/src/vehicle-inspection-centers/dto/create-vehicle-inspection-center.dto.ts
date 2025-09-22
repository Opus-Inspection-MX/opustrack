import {
  IsString,
  IsOptional,
  IsInt,
  IsNotEmpty,
  IsBoolean,
} from 'class-validator';

export class CreateVehicleInspectionCenterDto {
  @IsString({ message: 'El código es obligatorio y debe ser una cadena.' })
  @IsNotEmpty({ message: 'El código es obligatorio.' })
  code: string;

  @IsString({ message: 'El nombre es obligatorio y debe ser una cadena.' })
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  name: string;

  @IsOptional()
  @IsString({ message: 'La dirección debe ser una cadena.' })
  address?: string;

  @IsOptional()
  @IsString({ message: 'El RFC debe ser una cadena.' })
  rfc?: string;

  @IsOptional()
  @IsString({ message: 'La razón social debe ser una cadena.' })
  companyName?: string;

  @IsOptional()
  @IsString({ message: 'El teléfono debe ser una cadena.' })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'El contacto debe ser una cadena.' })
  contact?: string;

  @IsOptional()
  @IsString({ message: 'El correo electrónico debe ser una cadena.' })
  email?: string;

  @IsInt({ message: 'Las líneas deben ser un número entero.' })
  lines: number;

  @IsInt({ message: 'El ID del estado debe ser un número entero.' })
  stateId: number;

  @IsOptional()
  @IsBoolean({ message: 'El campo activo debe ser booleano.' })
  active?: boolean;
}
