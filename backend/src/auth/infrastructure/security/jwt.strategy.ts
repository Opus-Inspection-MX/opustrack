import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: any) {
    // Lo que estará disponible en req.user
    return {
      userId: payload.sub,
      roleId: payload.roleId,
      email: payload.email,
      name: payload.name,
      active: payload.active,
      token: ExtractJwt.fromAuthHeaderAsBearerToken(),
    };
  }
}
