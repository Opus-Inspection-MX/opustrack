import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shared/infrastructure/prisma/prisma.service';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';

@Injectable()
export class WorkOrderService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateWorkOrderDto) {
    return this.prisma.workOrder.create({
      data: {
        ...data,
        notes: data.notes ?? null,
        startedAt: data.startedAt ?? null,
        finishedAt: data.finishedAt ?? null,
        active: data.active ?? true,
      },
    });
  }

  async findAll() {
    return this.prisma.workOrder.findMany();
  }

  async findOne(id: string) {
    return this.prisma.workOrder.findUnique({ where: { id } });
  }

  async update(id: string, data: Partial<CreateWorkOrderDto>) {
    return this.prisma.workOrder.update({
      where: { id },
      data: {
        ...data,
        notes: data.notes ?? null,
        startedAt: data.startedAt ?? null,
        finishedAt: data.finishedAt ?? null,
        active: data.active ?? true,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.workOrder.delete({ where: { id } });
  }
}
