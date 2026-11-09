import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { UsersModule } from '../users/users.module';
import { CustomersModule } from '../customers/customers.module';
import { resolveJwtSecret } from './jwt-secret';

@Module({
  imports: [UsersModule, CustomersModule, PassportModule, JwtModule.registerAsync({ inject: [ConfigService], useFactory: (config: ConfigService) => ({
    secret: resolveJwtSecret(config), signOptions: { expiresIn: '1d' },
  }) })],
  controllers: [AuthController], providers: [AuthService, JwtStrategy], exports: [AuthService],
})
export class AuthModule {}
