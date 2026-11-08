import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  const databaseUrl = 'postgresql://test:test@localhost:5432/sweethome_test';
  let configService: jest.Mocked<Pick<ConfigService, 'getOrThrow'>>;

  beforeEach(() => {
    configService = {
      getOrThrow: jest.fn().mockReturnValue(databaseUrl),
    };
  });

  it('does not establish a database connection during construction', () => {
    const connect = jest.spyOn(PrismaService.prototype, '$connect');

    const service = new PrismaService(configService as unknown as ConfigService);

    expect(configService.getOrThrow).toHaveBeenCalledWith('DATABASE_URL');
    expect(service).toBeDefined();
    expect(connect).not.toHaveBeenCalled();
    connect.mockRestore();
  });

  it('disconnects Prisma when its module is destroyed', async () => {
    const service = new PrismaService(configService as unknown as ConfigService);
    const disconnect = jest.spyOn(service, '$disconnect').mockResolvedValue(undefined);

    await service.onModuleDestroy();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
