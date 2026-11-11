import { ConfigService } from '@nestjs/config';

export function resolveJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET');
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'test') return 'SH07-test-only-not-for-production';
  throw new Error('JWT_SECRET must be configured with at least 32 characters');
}
