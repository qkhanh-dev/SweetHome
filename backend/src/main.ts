import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const DEFAULT_PORT = 3001;
const API_PREFIX = 'api';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configuredPort = Number.parseInt(process.env.PORT ?? '', 10);
  const port =
    Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : DEFAULT_PORT;

  app.setGlobalPrefix(process.env.API_PREFIX ?? API_PREFIX);
  await app.listen(port);

  Logger.log(`SweetHome Backend listening on port ${port}`, 'Bootstrap');
}

void bootstrap();
