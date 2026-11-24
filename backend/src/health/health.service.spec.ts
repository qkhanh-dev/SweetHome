import { ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  const queryRaw = jest.fn<Promise<unknown>, [TemplateStringsArray]>();
  const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
  const service = new HealthService(prisma);

  beforeEach(() => {
    queryRaw.mockReset();
  });

  it('returns the Contract health data after a read-only database query', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    await expect(service.check()).resolves.toEqual({
      status: 'UP',
      database: 'CONNECTED',
      version: '2.0.0',
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(queryRaw.mock.calls[0][0].raw).toEqual(['SELECT 1']);
  });

  it('maps database errors to ServiceUnavailableException without exposing the cause', async () => {
    const databaseUrl = 'postgresql://user:secret@db:5432/sweethome';
    queryRaw.mockRejectedValue(new Error(databaseUrl));

    try {
      await service.check();
      fail('Expected HealthService.check to throw');
    } catch (exception) {
      expect(exception).toBeInstanceOf(ServiceUnavailableException);

      const serviceUnavailableException = exception as ServiceUnavailableException;
      expect(serviceUnavailableException.getStatus()).toBe(503);
      expect(JSON.stringify(serviceUnavailableException.getResponse())).not.toContain(databaseUrl);
    }
  });
});
