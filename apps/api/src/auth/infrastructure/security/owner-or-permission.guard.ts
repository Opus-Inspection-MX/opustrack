import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from 'src/shared/infrastructure/prisma/prisma.service';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class OwnerOrPermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user; // { userId, roleId, ... }
    const targetId = req.params.id; // id del perfil que se quiere editar

    // 1) **Dueño del recurso** (edit self)
    if (targetId && targetId === user.userId) {
      return true;
    }

    // 2) **No es dueño** → verificar permiso
    const requiredPerms =
      this.reflector.get<string[]>(PERMISSIONS_KEY, context.getHandler()) || [];
    if (requiredPerms.length === 0) {
      // Si no hay permisos requeridos, dejamos pasar
      return true;
    }

    // Obtener permisos activos de este rol
    const rolePerms = await this.prisma.rolePermission.findMany({
      where: {
        roleId: user.roleId,
        active: true,
        permission: { active: true },
      },
      include: { permission: true },
    });
    const names = rolePerms.map((rp) => rp.permission.name);

    const hasAll = requiredPerms.every((p) => names.includes(p));
    if (!hasAll) {
      throw new ForbiddenException('Permiso denegado');
    }
    return true;
  }
}
