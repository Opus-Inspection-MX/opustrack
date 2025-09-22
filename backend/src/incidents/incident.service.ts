import { Injectable } from '@nestjs/common';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { PrismaService } from '../shared/infrastructure/prisma/prisma.service';

@Injectable()
export class IncidentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateIncidentDto) {
    // Remove typeId if it's undefined to satisfy Prisma's type requirements
    return this.prisma.incident.create({
      data: {
        ...data,
        typeId: data.typeId ?? null,
        statusId: data.statusId ?? null,
        reportedAt: data.reportedAt ?? undefined,
        resolvedAt: data.resolvedAt ?? null,
        vicId: data.vicId ?? null,
        reportedById: data.reportedById ?? null,
        scheduleId: data.scheduleId ?? null,
        userId: data.userId ?? null,
        active: data.active ?? true,
      },
    });
  }

  async findAll() {
    return this.prisma.incident.findMany();
  }

  async findOne(id: number) {
    return this.prisma.incident.findUnique({ where: { id } });
  }

  async update(id: number, data: Partial<CreateIncidentDto>) {
    return this.prisma.incident.update({ where: { id }, data });
  }

  async remove(id: number) {
    return this.prisma.incident.delete({ where: { id } });
  }
}
