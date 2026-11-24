export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly payload: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function createErrorPayload(
  statusCode: number,
  message: string,
  path: string,
): Record<string, unknown> {
  const errorName =
    statusCode === 400
      ? "Bad Request"
      : statusCode === 401
        ? "Unauthorized"
        : statusCode === 403
          ? "Forbidden"
          : statusCode === 404
            ? "Not Found"
            : statusCode === 409
              ? "Conflict"
              : "Internal Server Error";

  return {
    success: false,
    statusCode,
    error: errorName,
    message,
    details: [],
    path,
    timestamp: new Date().toISOString(),
  };
}
