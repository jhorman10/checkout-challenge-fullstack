import { describe, it, expect } from 'vitest';
import { mapWompiStatus, mapWompiResponseToResult, mapWompiErrorToDomainError } from './wompi.mapper.js';
import { WompiTransactionResponse, WompiTransactionStatus } from './dto/wompi.dto.js';

describe('wompi.mapper', () => {
  const createMockResponse = (status: WompiTransactionStatus, message?: string): WompiTransactionResponse => ({
    id: 'txn_abc123',
    status,
    amountInCents: 150000,
    currency: 'COP',
    reference: 'TXN-123456789-100',
    customerEmail: 'test@example.com',
    createdAt: '2024-01-15T10:30:00.000Z',
    message,
  });

  describe('mapWompiStatus', () => {
    it('maps APPROVED to approved', () => {
      const response = createMockResponse(WompiTransactionStatus.APPROVED);
      const result = mapWompiStatus(response);
      expect(result.status).toBe('approved');
      expect(result.providerStatus).toBe(WompiTransactionStatus.APPROVED);
      expect(result.error).toBeUndefined();
    });

    it('maps DECLINED to failed with PAYMENT_DECLINED error', () => {
      const response = createMockResponse(WompiTransactionStatus.DECLINED, 'Card declined');
      const result = mapWompiStatus(response);
      expect(result.status).toBe('failed');
      expect(result.providerStatus).toBe(WompiTransactionStatus.DECLINED);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('PAYMENT_DECLINED');
    });

    it('maps PENDING to pending', () => {
      const response = createMockResponse(WompiTransactionStatus.PENDING);
      const result = mapWompiStatus(response);
      expect(result.status).toBe('pending');
      expect(result.providerStatus).toBe(WompiTransactionStatus.PENDING);
      expect(result.error).toBeUndefined();
    });

    it('maps ERROR to failed with PROVIDER_ERROR', () => {
      const response = createMockResponse(WompiTransactionStatus.ERROR, 'Provider error');
      const result = mapWompiStatus(response);
      expect(result.status).toBe('failed');
      expect(result.providerStatus).toBe(WompiTransactionStatus.ERROR);
      expect(result.error?.code).toBe('PROVIDER_ERROR');
    });

    it('maps VOIDED to failed with PAYMENT_DECLINED', () => {
      const response = createMockResponse(WompiTransactionStatus.VOIDED);
      const result = mapWompiStatus(response);
      expect(result.status).toBe('failed');
      expect(result.providerStatus).toBe(WompiTransactionStatus.VOIDED);
      expect(result.error?.code).toBe('PAYMENT_DECLINED');
    });

    it('maps unknown status to failed with PROVIDER_ERROR', () => {
      const response = createMockResponse('UNKNOWN' as WompiTransactionStatus);
      const result = mapWompiStatus(response);
      expect(result.status).toBe('failed');
      expect(result.providerStatus).toBe(WompiTransactionStatus.ERROR);
      expect(result.error?.code).toBe('PROVIDER_ERROR');
    });
  });

  describe('mapWompiResponseToResult', () => {
    it('returns Ok for APPROVED', () => {
      const response = createMockResponse(WompiTransactionStatus.APPROVED);
      const result = mapWompiResponseToResult(response);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('approved');
      }
    });

    it('returns Err for DECLINED', () => {
      const response = createMockResponse(WompiTransactionStatus.DECLINED);
      const result = mapWompiResponseToResult(response);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PAYMENT_DECLINED');
      }
    });
  });

  describe('mapWompiErrorToDomainError', () => {
    it('maps 400 to INVALID_INPUT', () => {
      const error = { status: 400, code: 'BAD_REQUEST', providerMessage: 'Invalid amount' };
      const result = mapWompiErrorToDomainError(error);
      expect(result.code).toBe('INVALID_INPUT');
    });

    it('maps 401 to INVALID_INPUT', () => {
      const error = { status: 401, code: 'UNAUTHORIZED', providerMessage: 'Invalid API key' };
      const result = mapWompiErrorToDomainError(error);
      expect(result.code).toBe('INVALID_INPUT');
    });

    it('maps 429 to PROVIDER_ERROR', () => {
      const error = { status: 429, code: 'RATE_LIMIT', providerMessage: 'Too many requests' };
      const result = mapWompiErrorToDomainError(error);
      expect(result.code).toBe('PROVIDER_ERROR');
    });

    it('maps 500 to PROVIDER_ERROR', () => {
      const error = { status: 500, code: 'SERVER_ERROR', providerMessage: 'Internal error' };
      const result = mapWompiErrorToDomainError(error);
      expect(result.code).toBe('PROVIDER_ERROR');
    });

    it('maps 503 to PROVIDER_ERROR', () => {
      const error = { status: 503, code: 'SERVICE_UNAVAILABLE', providerMessage: 'Service unavailable' };
      const result = mapWompiErrorToDomainError(error);
      expect(result.code).toBe('PROVIDER_ERROR');
    });
  });
});