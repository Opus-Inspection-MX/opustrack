import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true; // no requiere permiso
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.roleId) {
      throw new ForbiddenException('Sin rol asignado');
    }

    // Consulta permisos activos de este rol
    const rolePerms = await this.prisma.rolePermission.findMany({
      where: {
        roleId: user.roleId,
        active: true,
        permission: { active: true },
      },
      include: { permission: true },
    });
    const names = rolePerms.map((rp) => rp.permission.name);

    const hasAll = requiredPermissions.every((p) => names.includes(p));
    if (!hasAll) {
      throw new ForbiddenException('Permiso denegado');
    }
    return true;
  }
}
