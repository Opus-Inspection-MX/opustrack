export class RoleNotFoundError extends Error {
  constructor(id: number) {
    super(`Role with id ${id} not found.`);
  }
}

export class UserStatusNotFoundError extends Error {
  constructor(id: number) {
    super(`UserStatus with id ${id} not found.`);
  }
}

export class VehicleInspectionCenterNotFoundError extends Error {
  constructor(id: string) {
    super(`VehicleInspectionCenter with id ${id} not found.`);
  }
}
