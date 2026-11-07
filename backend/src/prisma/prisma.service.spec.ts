import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('does not establish a database connection during construction', () => {
    const connect = jest.spyOn(PrismaService.prototype, '$connect');

    new PrismaService();

    expect(connect).not.toHaveBeenCalled();
    connect.mockRestore();
  });

  it('disconnects Prisma when its module is destroyed', async () => {
    const service = new PrismaService();
    const disconnect = jest.spyOn(service, '$disconnect').mockResolvedValue(undefined);

    await service.onModuleDestroy();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
