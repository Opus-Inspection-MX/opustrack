import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/database/prisma.singleton";
import { Prisma } from "@prisma/client";
import type { PermissionName } from "@/lib/authz";

// Select/include tipado para alinear con Prisma
const userWithRolePerms = Prisma.validator<Prisma.UserDefaultArgs>()({
  include: {
    role: { include: { rolePermission: { include: { permission: true } } } },
  },
});
export type UserWithRolePermissions = Prisma.UserGetPayload<
  typeof userWithRolePerms
>;

export async function getSessionUserOrThrow(): Promise<UserWithRolePermissions> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("No autenticado");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    ...userWithRolePerms,
  });
  if (!user) throw new Error("Usuario no encontrado");
  return user;
}

export function assertCan(
  user: UserWithRolePermissions,
  permissionName: PermissionName,
): asserts user is UserWithRolePermissions {
  const ok = user.role.rolePermission.some(
    (rp) => rp.permission.name === permissionName,
  );
  if (!ok) throw new Error("No autorizado");
}

