import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Allows public requests when no Authorization header is provided,
 * while still validating Bearer tokens if a client sends one.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  override canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ headers?: { authorization?: string } }>();
    if (!request.headers?.authorization) {
      return true;
    }
    return super.canActivate(context);
  }

  override handleRequest<TUser = unknown>(err: unknown, user: TUser, info: unknown): TUser {
    if (err || !user) {
      if (err instanceof Error) {
        throw err;
      }
      const message =
        info instanceof Error ? info.message : 'Token xác thực không hợp lệ hoặc đã hết hạn';
      throw new UnauthorizedException(message);
    }
    return user;
  }
}
