export class UserAlreadyActiveError extends Error {
  constructor(id: string) {
    super(`User with id ${id} is already active.`);
  }
}

export class UserAlreadyInactiveError extends Error {
  constructor(id: string) {
    super(`User with id ${id} is already inactive.`);
  }
}
