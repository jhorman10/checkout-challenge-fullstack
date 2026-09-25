import { describe, expect, it } from 'vitest';
import {
  domainError,
  ErrorMessages,
  ErrorCode,
  toHttpStatus,
} from './errors.js';

const ALL_CODES: ErrorCode[] = [
  'INSUFFICIENT_STOCK',
  'PRODUCT_NOT_FOUND',
  'INVALID_INPUT',
  'PAYMENT_DECLINED',
  'PROVIDER_ERROR',
  'DUPLICATE_OPERATION',
];

describe('Error taxonomy', () => {
  describe('ErrorCode', () => {
    it('includes all required codes from the spec', () => {
      expect(ALL_CODES).toHaveLength(6);
      for (const code of ALL_CODES) {
        expect(typeof code).toBe('string');
      }
    });

    it('ErrorMessages has a default message for every code', () => {
      for (const code of ALL_CODES) {
        expect(ErrorMessages[code]).toBeTruthy();
        expect(typeof ErrorMessages[code]).toBe('string');
      }
    });
  });

  describe('domainError()', () => {
    it('uses the default message when none is provided', () => {
      const error = domainError('PRODUCT_NOT_FOUND');

      expect(error.code).toBe('PRODUCT_NOT_FOUND');
      expect(error.message).toBe(ErrorMessages.PRODUCT_NOT_FOUND);
    });

    it('accepts a custom override message', () => {
      const error = domainError('INVALID_INPUT', 'Quantity must be positive');

      expect(error.code).toBe('INVALID_INPUT');
      expect(error.message).toBe('Quantity must be positive');
    });
  });

  describe('toHttpStatus()', () => {
    it.each([
      ['INSUFFICIENT_STOCK', 400],
      ['INVALID_INPUT', 400],
      ['PAYMENT_DECLINED', 402],
      ['PRODUCT_NOT_FOUND', 404],
      ['DUPLICATE_OPERATION', 409],
      ['PROVIDER_ERROR', 502],
    ])('maps %s → %i', (code, expected) => {
      expect(toHttpStatus(code as ErrorCode)).toBe(expected);
    });

    it('returns 500 for unknown codes via exhaustive default', () => {
      // Simulate an unknown code by casting through unknown
      const unknown = ('UNKNOWN' as unknown) as ErrorCode;
      expect(toHttpStatus(unknown)).toBe(500);
    });
  });
});
