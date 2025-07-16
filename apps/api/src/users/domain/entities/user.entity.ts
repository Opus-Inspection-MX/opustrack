export class User {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly email: string,
  ) {
    if (!email.includes('@')) throw new Error('Invalid email');
  }
}
