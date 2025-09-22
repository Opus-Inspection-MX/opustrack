import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { VehicleInspectionCenterService } from './vehicle-inspection-center.service';
import { CreateVehicleInspectionCenterDto } from './dto/create-vehicle-inspection-center.dto';

@Controller('vehicle-inspection-centers')
export class VehicleInspectionCenterController {
  constructor(
    private readonly vehicleInspectionCenterService: VehicleInspectionCenterService,
  ) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true }))
  create(
    @Body() createVehicleInspectionCenterDto: CreateVehicleInspectionCenterDto,
  ) {
    return this.vehicleInspectionCenterService.create(
      createVehicleInspectionCenterDto,
    );
  }

  @Get()
  findAll() {
    return this.vehicleInspectionCenterService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vehicleInspectionCenterService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDto: Partial<CreateVehicleInspectionCenterDto>,
  ) {
    return this.vehicleInspectionCenterService.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.vehicleInspectionCenterService.remove(id);
  }
}
