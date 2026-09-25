import { describe, expect, it, vi } from 'vitest';
import { err, isErr, isOk, map, ok, tryCatch } from './result.js';

describe('Result', () => {
  describe('ok()', () => {
    it('creates an Ok result carrying the value', () => {
      const result = ok(42);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(42);
      }
    });

    it('preserves object identity of the value', () => {
      const obj = { id: 'abc' };
      const result = ok(obj);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(obj);
      }
    });
  });

  describe('err()', () => {
    it('creates an Err result carrying the error', () => {
      const error = { code: 'PRODUCT_NOT_FOUND' as const, message: 'Missing' };
      const result = err(error);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(error);
      }
    });
  });

  describe('isOk()', () => {
    it('returns true for an Ok result', () => {
      expect(isOk(ok('hello'))).toBe(true);
    });

    it('returns false for an Err result', () => {
      expect(isOk(err('bad'))).toBe(false);
    });
  });

  describe('isErr()', () => {
    it('returns true for an Err result', () => {
      expect(isErr(err('bad'))).toBe(true);
    });

    it('returns false for an Ok result', () => {
      expect(isErr(ok('hello'))).toBe(false);
    });

    it('is the logical complement of isOk', () => {
      const okResult = ok(1);
      const errResult = err('e');

      expect(isErr(okResult)).toBe(!isOk(okResult));
      expect(isErr(errResult)).toBe(!isOk(errResult));
    });
  });

  describe('map()', () => {
    it('transforms the Ok value', () => {
      const result = map(ok(5), (v) => v * 2);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(10);
      }
    });

    it('passes the Err through unchanged', () => {
      const error = { code: 'INVALID', message: 'bad' };
      const result = map(err(error), (v: number) => v * 2);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(error);
      }
    });

    it('preserves the error type across multiple maps', () => {
      const result = map(err({ code: 'X', message: 'x' }), (v: number) => v + 1);

      expect(result.ok).toBe(false);
    });
  });

  describe('tryCatch()', () => {
    it('returns Ok when the function resolves', async () => {
      const result = await tryCatch(() => Promise.resolve(42), () => 'never');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(42);
      }
    });

    it('returns Err when the function throws', async () => {
      const mapError = vi.fn(() => 'mapped-error');
      const result = await tryCatch(
        () => Promise.reject(new Error('boom')),
        mapError,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('mapped-error');
      }
      expect(mapError).toHaveBeenCalledTimes(1);
    });

    it('returns Err when the function throws a non-Error value', async () => {
      const result = await tryCatch(
        () => Promise.reject(42),
        (e) => `got-${e}`,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('got-42');
      }
    });

    it('maps the original error to the provided type', async () => {
      const result = await tryCatch(
        () => Promise.reject(new Error('network failure')),
        (e) => ({ code: 'PROVIDER_ERROR' as const, reason: (e as Error).message }),
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('PROVIDER_ERROR');
        expect(result.error.reason).toBe('network failure');
      }
    });
  });
});
