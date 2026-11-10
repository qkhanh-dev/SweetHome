import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  const databaseUrl = 'postgresql://test:test@localhost:5432/sweethome_test';
  const createConfig = () =>
    ({
      getOrThrow: jest.fn().mockReturnValue(databaseUrl),
    }) as unknown as ConfigService;

  it('uses the ConfigService DATABASE_URL without connecting during construction', async () => {
    const config = createConfig();
    const connect = jest.spyOn(PrismaService.prototype, '$connect');
    const service = new PrismaService(config);

    expect(config.getOrThrow).toHaveBeenCalledWith('DATABASE_URL');
    expect(service).toBeDefined();
    expect(connect).not.toHaveBeenCalled();

    await service.$disconnect();
    connect.mockRestore();
  });

  it('disconnects Prisma when its module is destroyed', async () => {
    const service = new PrismaService(createConfig());
    const disconnect = jest.spyOn(service, '$disconnect').mockResolvedValue(undefined);

    await service.onModuleDestroy();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
