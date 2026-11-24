import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

const DEFAULT_CORS_ORIGIN = 'http://localhost:3000';

export function createCorsOptions(configuredOrigins?: string): CorsOptions {
  const allowedOrigins = (configuredOrigins || DEFAULT_CORS_ORIGIN)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
  };
}
