import { INestApplication, ValidationPipe } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { ResponseEnvelopeInterceptor } from '../common/interceptors/response-envelope.interceptor';
import { createCorsOptions } from './cors.config';
import { createSwaggerDocument } from './swagger.config';

const DEFAULT_API_PREFIX = 'api';
const DEFAULT_PORT = 3001;

interface HttpAppOptions {
  apiPrefix?: string;
  corsOrigin?: string;
}

export function getPort(value?: string): number {
  const parsedPort = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT;
}

export function configureHttpApp(app: INestApplication, options: HttpAppOptions = {}): void {
  app.setGlobalPrefix(options.apiPrefix || DEFAULT_API_PREFIX);
  app.enableCors(createCorsOptions(options.corsOrigin));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
}

export function setupSwagger(app: INestApplication): void {
  const document = createSwaggerDocument(app);
  SwaggerModule.setup('api/docs', app, document);
}
