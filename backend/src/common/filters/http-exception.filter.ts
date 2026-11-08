import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponseBody {
  message?: string | string[];
  error?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    if (response.headersSent || response.writableEnded) {
      return;
    }

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = isHttpException ? exception.getResponse() : undefined;
    const normalized = this.isServerError(statusCode)
      ? this.createSafeServerError()
      : this.normalizeExceptionResponse(exceptionResponse);

    response.status(statusCode).json({
      success: false,
      statusCode,
      error: normalized.error || this.getHttpErrorName(statusCode),
      message: normalized.message,
      details: normalized.details,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private isServerError(statusCode: number): boolean {
    return statusCode >= HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private createSafeServerError(): { error: string; message: string; details: string[] } {
    return {
      error: 'Internal Server Error',
      message: 'Đã xảy ra lỗi nội bộ. Vui lòng thử lại sau.',
      details: [],
    };
  }

  private getHttpErrorName(statusCode: number): string {
    const enumName = HttpStatus[statusCode];
    if (typeof enumName !== 'string') {
      return this.isServerError(statusCode) ? 'Internal Server Error' : 'HTTP Error';
    }

    return enumName
      .split('_')
      .map((word) => `${word[0]}${word.slice(1).toLowerCase()}`)
      .join(' ');
  }

  private normalizeExceptionResponse(response: string | object | undefined): {
    error?: string;
    message: string;
    details: string[];
  } {
    if (typeof response === 'string') {
      return { message: response, details: [] };
    }

    if (response && typeof response === 'object') {
      const body = response as ErrorResponseBody;
      if (Array.isArray(body.message)) {
        return {
          error: body.error,
          message: 'Dữ liệu đầu vào không hợp lệ',
          details: body.message,
        };
      }

      return {
        error: body.error,
        message: body.message || 'Yêu cầu không thể xử lý',
        details: [],
      };
    }

    return { message: 'Yêu cầu không thể xử lý', details: [] };
  }
}
