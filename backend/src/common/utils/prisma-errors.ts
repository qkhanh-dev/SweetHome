import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function rethrowPrismaError(error: unknown, duplicateMessage = 'Dữ liệu đã tồn tại'): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') throw new ConflictException(duplicateMessage);
    if (error.code === 'P2003') throw new ConflictException('Dữ liệu đang được tham chiếu');
    if (error.code === 'P2025') throw new NotFoundException('Không tìm thấy dữ liệu');
  }
  throw error;
}
