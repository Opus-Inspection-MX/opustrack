import { Global, Module } from '@nestjs/common';
import { PrismaService } from './infraestructure/prisma/prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class SharedModule {}
