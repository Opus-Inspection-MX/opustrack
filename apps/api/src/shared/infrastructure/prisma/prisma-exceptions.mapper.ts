import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function handlePrismaError(error: any): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        // Unique constraint failed
        throw new ConflictException(
          'Duplicate value: violates unique constraint',
        );
      case 'P2025':
        // Record not found
        throw new NotFoundException('Record not found');
      case 'P2003':
        // Foreign key constraint failed
        throw new BadRequestException(
          'Invalid reference (foreign key constraint failed)',
        );
      default:
        throw new BadRequestException(`Prisma error: ${error.message}`);
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    throw new BadRequestException(error.message);
  }

  // Fallback
  throw new InternalServerErrorException('Unexpected database error');
}
