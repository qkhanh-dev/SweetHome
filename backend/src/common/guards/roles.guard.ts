import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, UserRole } from '../decorators/roles.decorator';
import { CurrentAccountData } from '../decorators/current-account.decorator';

/** Inheritance from UML actor generalization: ADMIN has STAFF permissions. */
export function roleAllows(actual: UserRole, required: UserRole): boolean {
  return actual === required || (actual === 'ADMIN' && required === 'STAFF');
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const user = context.switchToHttp().getRequest<{ user?: CurrentAccountData }>().user;
    return Boolean(user && required.some((role) => roleAllows(user.vaiTro, role)));
  }
}
