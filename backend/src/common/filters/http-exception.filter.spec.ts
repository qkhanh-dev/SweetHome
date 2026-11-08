/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  function createHost(responseState: { headersSent?: boolean; writableEnded?: boolean } = {}) {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const response = { status, ...responseState };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ url: '/api/test' }),
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;

    return { host, json, status };
  }

  it('normalizes a 400 validation error without exposing internals', () => {
    const { host, json, status } = createHost();

    filter.catch(new BadRequestException(['email must be an email']), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 400,
        error: 'Bad Request',
        message: 'Dữ liệu đầu vào không hợp lệ',
        details: ['email must be an email'],
        path: '/api/test',
      }),
    );
  });

  it('preserves a 404 status code', () => {
    const { host, json, status } = createHost();

    filter.catch(new NotFoundException('Không tìm thấy tài nguyên'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 404,
        error: 'Not Found',
        message: 'Không tìm thấy tài nguyên',
        details: [],
      }),
    );
  });

  it('preserves a valid custom 409 business message and always includes error', () => {
    const { host, json, status } = createHost();

    filter.catch(
      new ConflictException({
        error: 'Conflict',
        message: 'Phòng đã có khách khác đặt trong khoảng thời gian này',
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 409,
        error: 'Conflict',
        message: 'Phòng đã có khách khác đặt trong khoảng thời gian này',
        details: [],
      }),
    );
  });

  it('uses the HTTP error name when a custom 4xx response omits error', () => {
    const { host, json } = createHost();

    filter.catch(new HttpException({ message: 'Dữ liệu không hợp lệ' }, 400), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Bad Request',
        message: 'Dữ liệu không hợp lệ',
      }),
    );
  });

  it('returns a safe 500 response for unknown errors', () => {
    const { host, json, status } = createHost();

    filter.catch(new Error('database password leaked'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Đã xảy ra lỗi nội bộ. Vui lòng thử lại sau.',
        details: [],
      }),
    );
    expect(json).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: 'database password leaked' }),
    );
  });

  it('does not expose sensitive content from an HttpException with status 500', () => {
    const { host, json, status } = createHost();
    const sensitiveMessage = 'postgresql://admin:secret@db.internal:5432/sweethome';

    filter.catch(
      new HttpException(
        {
          error: 'Database connection failed',
          message: sensitiveMessage,
          details: ['SQLSTATE 28P01'],
        },
        500,
      ),
      host,
    );

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Đã xảy ra lỗi nội bộ. Vui lòng thử lại sau.',
        details: [],
      }),
    );
    expect(json).not.toHaveBeenCalledWith(expect.objectContaining({ message: sensitiveMessage }));
  });

  it('keeps status 503 and safely redacts internal HttpException details', () => {
    const { host, json, status } = createHost();
    const sensitiveMessage = 'database connection refused for sweethome_user@postgres:5432';

    filter.catch(
      new HttpException(
        {
          error: 'Service Unavailable',
          message: sensitiveMessage,
          details: ['ECONNREFUSED'],
        },
        503,
      ),
      host,
    );

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 503,
        error: 'Internal Server Error',
        message: 'Đã xảy ra lỗi nội bộ. Vui lòng thử lại sau.',
        details: [],
        path: '/api/test',
        timestamp: expect.any(String),
      }),
    );
    expect(json).not.toHaveBeenCalledWith(expect.objectContaining({ message: sensitiveMessage }));
  });

  it('does not write a second response after headers have been sent', () => {
    const { host, json, status } = createHost({ headersSent: true });

    filter.catch(new BadRequestException('Không hợp lệ'), host);

    expect(status).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
  });
});
