import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shared/infrastructure/prisma/prisma.service';
import { CreateVehicleInspectionCenterDto } from './dto/create-vehicle-inspection-center.dto';

@Injectable()
export class VehicleInspectionCenterService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateVehicleInspectionCenterDto) {
    return this.prisma.vehicleInspectionCenter.create({
      data: {
        ...data,
        address: data.address ?? null,
        rfc: data.rfc ?? null,
        companyName: data.companyName ?? null,
        phone: data.phone ?? null,
        contact: data.contact ?? null,
        email: data.email ?? null,
        active: data.active ?? true,
      },
    });
  }

  async findAll() {
    return this.prisma.vehicleInspectionCenter.findMany();
  }

  async findOne(id: string) {
    return this.prisma.vehicleInspectionCenter.findUnique({ where: { id } });
  }

  async update(id: string, data: Partial<CreateVehicleInspectionCenterDto>) {
    return this.prisma.vehicleInspectionCenter.update({
      where: { id },
      data: {
        ...data,
        address: data.address ?? null,
        rfc: data.rfc ?? null,
        companyName: data.companyName ?? null,
        phone: data.phone ?? null,
        contact: data.contact ?? null,
        email: data.email ?? null,
        active: data.active ?? true,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.vehicleInspectionCenter.delete({ where: { id } });
  }
}
