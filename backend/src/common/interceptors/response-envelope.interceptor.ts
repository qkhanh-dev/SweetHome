import { isSh07Result } from '../utils/sh07-result';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface ResponseEnvelope<T> {
  success: true;
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
}

@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<T, T | ResponseEnvelope<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<T | ResponseEnvelope<T>> {
    return next.handle().pipe(
      map((data) => {
        const response = context.switchToHttp().getResponse<Response>();
        if (this.shouldBypassEnvelope(data, response)) {
          return data;
        }

        if (this.isEnvelope(data)) {
          return data;
        }

        const payload = isSh07Result(data) ? data.data : data;
        const message = isSh07Result(data) ? data.message : 'Thao tác thành công';
        return {
          success: true,
          statusCode: response.statusCode,
          message,
          data: payload as T,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }

  private shouldBypassEnvelope(data: unknown, response: Response): boolean {
    return (
      data === undefined ||
      data === null ||
      response.statusCode === 204 ||
      response.statusCode === 304 ||
      response.headersSent ||
      response.writableEnded ||
      data instanceof StreamableFile ||
      Buffer.isBuffer(data) ||
      data instanceof Uint8Array
    );
  }

  private isEnvelope(data: unknown): data is ResponseEnvelope<unknown> {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const candidate = data as Partial<ResponseEnvelope<unknown>>;
    return (
      candidate.success === true &&
      typeof candidate.statusCode === 'number' &&
      typeof candidate.message === 'string' &&
      'data' in candidate &&
      typeof candidate.timestamp === 'string'
    );
  }
}
