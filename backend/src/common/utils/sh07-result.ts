/** Feature response payload understood by the existing SH-04 envelope interceptor. */
export const SH07_RESULT = Symbol('SH07_RESULT');
export interface Sh07Result<T> {
  message: string;
  data: T;
  [SH07_RESULT]: true;
}
export function result<T>(message: string, data: T): Sh07Result<T> {
  return { message, data, [SH07_RESULT]: true };
}
export function isSh07Result(value: unknown): value is Sh07Result<unknown> {
  return typeof value === 'object' && value !== null && SH07_RESULT in value;
}
