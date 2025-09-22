import { Module } from '@nestjs/common';
import { IncidentService } from './incident.service';
import { IncidentController } from './incident.controller';
import { PrismaService } from '../shared/infrastructure/prisma/prisma.service';

@Module({
  controllers: [IncidentController],
  providers: [IncidentService, PrismaService],
})
export class IncidentModule {}
