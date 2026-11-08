/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { CallHandler, ExecutionContext, StreamableFile } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor';

describe('ResponseEnvelopeInterceptor', () => {
  const interceptor = new ResponseEnvelopeInterceptor<{ id: string }>();
  function createContext(response: Record<string, unknown> = {}): ExecutionContext {
    return {
      switchToHttp: () => ({
        getResponse: () => ({ statusCode: 201, ...response }),
      }),
    } as unknown as ExecutionContext;
  }

  it('wraps a successful response in the API Contract envelope', async () => {
    const next: CallHandler<{ id: string }> = {
      handle: () => of({ id: 'HS001' }),
    };

    const result = await lastValueFrom(interceptor.intercept(createContext(), next));

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        statusCode: 201,
        message: 'Thao tác thành công',
        data: { id: 'HS001' },
        timestamp: expect.any(String),
      }),
    );
  });

  it('does not double-wrap an existing envelope', async () => {
    const envelope = {
      success: true as const,
      statusCode: 200,
      message: 'Đã có envelope',
      data: { id: 'HS002' },
      timestamp: '2026-11-07T00:00:00.000Z',
    };
    const next: CallHandler<unknown> = { handle: () => of(envelope) };
    const envelopeInterceptor = new ResponseEnvelopeInterceptor<unknown>();

    const result = await lastValueFrom(envelopeInterceptor.intercept(createContext(), next));

    expect(result).toBe(envelope);
  });

  it.each([204, 304])('does not add a body for HTTP %i', async (statusCode) => {
    const data = { ignored: true };
    const next: CallHandler<unknown> = { handle: () => of(data) };
    const bypassInterceptor = new ResponseEnvelopeInterceptor<unknown>();

    const result = await lastValueFrom(
      bypassInterceptor.intercept(createContext({ statusCode }), next),
    );

    expect(result).toBe(data);
  });

  it.each([
    ['StreamableFile', new StreamableFile(Buffer.from('pdf'))],
    ['Buffer', Buffer.from('pdf')],
    ['Uint8Array', new Uint8Array([1, 2, 3])],
  ])('bypasses %s responses without changing the payload', async (_name, data) => {
    const next: CallHandler<unknown> = { handle: () => of(data) };
    const binaryInterceptor = new ResponseEnvelopeInterceptor<unknown>();

    const result = await lastValueFrom(binaryInterceptor.intercept(createContext(), next));

    expect(result).toBe(data);
  });

  it('bypasses a response already handled by Express without changing file headers', async () => {
    const pdfData = { alreadyWritten: true };
    const response = {
      headersSent: true,
      getHeader: jest.fn((name: string) =>
        name === 'content-disposition' ? 'attachment; filename="BienLai_HD001.pdf"' : undefined,
      ),
    };
    const next: CallHandler<unknown> = { handle: () => of(pdfData) };
    const bypassInterceptor = new ResponseEnvelopeInterceptor<unknown>();

    const result = await lastValueFrom(bypassInterceptor.intercept(createContext(response), next));

    expect(result).toBe(pdfData);
    expect(response.getHeader('content-disposition')).toBe(
      'attachment; filename="BienLai_HD001.pdf"',
    );
  });
});
