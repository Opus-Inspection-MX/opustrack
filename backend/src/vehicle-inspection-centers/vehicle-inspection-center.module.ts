import { Module } from '@nestjs/common';
import { VehicleInspectionCenterService } from './vehicle-inspection-center.service';
import { VehicleInspectionCenterController } from './vehicle-inspection-center.controller';
import { PrismaService } from '../shared/infrastructure/prisma/prisma.service';

@Module({
  controllers: [VehicleInspectionCenterController],
  providers: [VehicleInspectionCenterService, PrismaService],
})
export class VehicleInspectionCenterModule {}
