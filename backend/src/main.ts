import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureHttpApp, getPort, setupSwagger } from './config/app.setup';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const configService = app.get(ConfigService);
  const port = getPort(configService.get<string>('PORT'));

  configureHttpApp(app, {
    apiPrefix: configService.get<string>('API_PREFIX'),
    corsOrigin: configService.get<string>('CORS_ORIGIN'),
  });
  setupSwagger(app);
  await app.listen(port);

  Logger.log(`SweetHome Backend listening on port ${port}`, 'Bootstrap');
}

void bootstrap();
