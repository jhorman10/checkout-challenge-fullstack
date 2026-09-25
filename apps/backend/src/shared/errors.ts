/**
 * Domain error taxonomy and HTTP status mapping.
 *
 * `DomainError` is a plain value — never a thrown exception. Domain use cases
 * return `Result<T, DomainError>` so that business-rule violations flow on the
 * Err railway. Controllers translate the `ErrorCode` to an HTTP status via
 * `toHttpStatus()`.
 */

export type ErrorCode =
  | 'INSUFFICIENT_STOCK'
  | 'PRODUCT_NOT_FOUND'
  | 'INVALID_INPUT'
  | 'PAYMENT_DECLINED'
  | 'PROVIDER_ERROR'
  | 'DUPLICATE_OPERATION';

export interface DomainError {
  code: ErrorCode;
  message: string;
}

/** Default human-readable messages indexed by error code. */
export const ErrorMessages: Record<ErrorCode, string> = {
  INSUFFICIENT_STOCK: 'Insufficient stock available',
  PRODUCT_NOT_FOUND: 'Product not found',
  INVALID_INPUT: 'Invalid input',
  PAYMENT_DECLINED: 'Payment was declined by the provider',
  PROVIDER_ERROR: 'Payment provider is unavailable',
  DUPLICATE_OPERATION: 'This operation has already been completed',
};

/** Creates a `DomainError` from a code, optionally overriding the message. */
export function domainError(
  code: ErrorCode,
  message?: string,
): DomainError {
  return { code, message: message ?? ErrorMessages[code] };
}

/**
 * Maps a domain error code to the HTTP status code that the controller should
 * return.
 *
 * | Code                  | Status | Meaning                        |
 * |-----------------------|--------|--------------------------------|
 * | INSUFFICIENT_STOCK    | 400    | Bad request — not enough stock |
 * | INVALID_INPUT         | 400    | Bad request — malformed input  |
 * | PAYMENT_DECLINED      | 402    | Payment required — declined    |
 * | PRODUCT_NOT_FOUND     | 404    | Resource does not exist        |
 * | DUPLICATE_OPERATION   | 409    | Conflict — already done        |
 * | PROVIDER_ERROR        | 502    | Bad gateway — provider down    |
 */
export function toHttpStatus(code: ErrorCode): number {
  switch (code) {
    case 'INSUFFICIENT_STOCK':
    case 'INVALID_INPUT':
      return 400;
    case 'PAYMENT_DECLINED':
      return 402;
    case 'PRODUCT_NOT_FOUND':
      return 404;
    case 'DUPLICATE_OPERATION':
      return 409;
    case 'PROVIDER_ERROR':
      return 502;
    default:
      return 500;
  }
}
