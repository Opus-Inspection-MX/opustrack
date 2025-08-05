export class User {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly email: string,
    public readonly password?: string,
    public readonly roleId?: number,
    public readonly userStatusId?: number,
    public readonly vicId?: string,
    public readonly active?: boolean,
    public readonly refreshToken?: string,
  ) {}
}
