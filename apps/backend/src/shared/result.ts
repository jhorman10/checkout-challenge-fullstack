/**
 * Result type for Railway-Oriented Programming.
 *
 * A `Result<T, E>` is a discriminated union: either `Ok` carrying a value of
 * type `T`, or `Err` carrying an error of type `E`. Domain operations return
 * `Result` instead of throwing exceptions so that success and failure paths are
 * explicit at the type level.
 */

export interface OkResult<T> {
  readonly ok: true;
  readonly value: T;
}

export interface ErrResult<E> {
  readonly ok: false;
  readonly error: E;
}

export type Result<T, E> = OkResult<T> | ErrResult<E>;

/** Creates a successful `Result` carrying `value`. */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/** Creates a failed `Result` carrying `error`. */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/** Type guard: `true` when `result` is an `Ok`. */
export function isOk<T, E>(result: Result<T, E>): result is OkResult<T> {
  return result.ok;
}

/** Type guard: `true` when `result` is an `Err`. */
export function isErr<T, E>(result: Result<T, E>): result is ErrResult<E> {
  return !result.ok;
}

/**
 * Maps the Ok value through `fn`. When `result` is `Err` the error is passed
 * through unchanged — the error railway is never touched.
 */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> {
  if (result.ok) {
    return ok(fn(result.value));
  }
  return result;
}

/**
 * Wraps an async operation that may throw into a `Result`.
 *
 * The `mapError` callback converts any thrown value into a typed error `E`,
 * so callers never need to handle raw exceptions from infrastructure
 * (axios, pg, etc.).
 */
export async function tryCatch<T, E>(
  fn: () => Promise<T>,
  mapError: (error: unknown) => E,
): Promise<Result<T, E>> {
  try {
    const value = await fn();
    return ok(value);
  } catch (error) {
    return err(mapError(error));
  }
}
