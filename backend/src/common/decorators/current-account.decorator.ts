import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from './roles.decorator';
export interface CurrentAccountData {
  maTaiKhoan: string;
  username: string;
  vaiTro: UserRole;
  trangThai: string;
}
export const CurrentAccount = createParamDecorator(
  (_: unknown, context: ExecutionContext): CurrentAccountData => {
    return context.switchToHttp().getRequest<{ user: CurrentAccountData }>().user;
  },
);
