import { PartialType } from '@nestjs/mapped-types';
import { CreateVehicleInspectionCenterDto } from './create-vehicle-inspection-center.dto';

export class UpdateVehicleInspectionCenterDto extends PartialType(
  CreateVehicleInspectionCenterDto,
) {}
