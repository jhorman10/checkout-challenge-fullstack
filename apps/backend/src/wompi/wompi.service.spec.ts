import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ok, err, isOk, isErr } from '../shared/result.js';
import { domainError } from '../shared/errors.js';
import { WompiError } from './wompi.client.js';
import { WompiTransactionStatus } from './dto/wompi.dto.js';
import { maskCard } from '../shared/redact.js';
import { WompiService } from './wompi.service.js';

describe('WompiService', () => {
  const mockWompiClient = {
    createTransaction: vi.fn(),
    getTransaction: vi.fn(),
  };

  const customer = {
    email: 'test@example.com',
    fullName: 'Juan Perez',
    legalId: '1234567890',
    legalIdType: 'CC',
  };

  const payment = {
    number: '4242424242424242',
    expMonth: '12',
    expYear: '2028',
    cvv: '123',
  };

  const registerInput = {
    reference: 'TXN-123',
    amount: 150000,
    currency: 'COP',
    customer,
    transactionId: 'txn-123',
  };

  const authorizeInput = {
    reference: 'TXN-123',
    amount: 150000,
    currency: 'COP',
    customer,
    payment,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerPaymentAttempt', () => {
    it('registers payment attempt successfully', async () => {
      const mockResponse = {
        id: 'txn_abc123',
        status: WompiTransactionStatus.PENDING,
        amountInCents: 150000,
        currency: 'COP',
        reference: 'TXN-123',
        customerEmail: 'test@example.com',
        createdAt: '2024-01-15T10:30:00.000Z',
      };

      mockWompiClient.createTransaction.mockResolvedValue(mockResponse);

      const service = new WompiService(mockWompiClient as any);
      const result = await service.registerPaymentAttempt(registerInput);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.mapped.status).toBe('pending');
        expect(result.value.rawProviderStatus).toBe(WompiTransactionStatus.PENDING);
      }
      expect(mockWompiClient.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          amountInCents: 150000,
          currency: 'COP',
          reference: 'TXN-123',
          customerEmail: 'test@example.com',
        }),
        'TXN-123',
      );
    });

    it('returns Err when WompiClient throws WompiError', async () => {
      const wompiError = new WompiError('Provider error', 400, 'BAD_REQUEST', 'Invalid amount');
      mockWompiClient.createTransaction.mockRejectedValue(wompiError);

      const service = new WompiService(mockWompiClient as any);
      const result = await service.registerPaymentAttempt(registerInput);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('INVALID_INPUT');
      }
    });

    it('returns Err(PROVIDER_ERROR) on network failure', async () => {
      mockWompiClient.createTransaction.mockRejectedValue(new Error('Network error'));

      const service = new WompiService(mockWompiClient as any);
      const result = await service.registerPaymentAttempt(registerInput);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('PROVIDER_ERROR');
      }
    });

    it('maps DECLINED response to Err', async () => {
      const mockResponse = {
        id: 'txn_abc123',
        status: WompiTransactionStatus.DECLINED,
        amountInCents: 150000,
        currency: 'COP',
        reference: 'TXN-123',
        customerEmail: 'test@example.com',
        createdAt: '2024-01-15T10:30:00.000Z',
        message: 'Card declined',
      };

      mockWompiClient.createTransaction.mockResolvedValue(mockResponse);

      const service = new WompiService(mockWompiClient as any);
      const result = await service.registerPaymentAttempt(registerInput);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('PAYMENT_DECLINED');
      }
    });
  });

  describe('authorizePayment', () => {
    it('authorizes payment successfully', async () => {
      const mockResponse = {
        id: 'txn_abc123',
        status: WompiTransactionStatus.APPROVED,
        amountInCents: 150000,
        currency: 'COP',
        reference: 'TXN-123',
        customerEmail: 'test@example.com',
        createdAt: '2024-01-15T10:30:00.000Z',
      };

      mockWompiClient.createTransaction.mockResolvedValue(mockResponse);

      const service = new WompiService(mockWompiClient as any);
      const result = await service.authorizePayment(authorizeInput);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.mapped.status).toBe('approved');
        expect(result.value.rawProviderStatus).toBe(WompiTransactionStatus.APPROVED);
      }
      expect(mockWompiClient.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          amountInCents: 150000,
          currency: 'COP',
          reference: 'TXN-123',
          paymentMethod: expect.objectContaining({
            type: 'CARD',
            card: expect.objectContaining({
              number: payment.number,
            }),
          }),
        }),
        'TXN-123',
      );
    });

    it('returns Err when WompiClient throws WompiError', async () => {
      const wompiError = new WompiError('Provider error', 500, 'SERVER_ERROR', 'Internal error');
      mockWompiClient.createTransaction.mockRejectedValue(wompiError);

      const service = new WompiService(mockWompiClient as any);
      const result = await service.authorizePayment(authorizeInput);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('PROVIDER_ERROR');
      }
    });

    it('returns Err on network failure', async () => {
      mockWompiClient.createTransaction.mockRejectedValue(new Error('Network error'));

      const service = new WompiService(mockWompiClient as any);
      const result = await service.authorizePayment(authorizeInput);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('PROVIDER_ERROR');
      }
    });

    it('uses idempotency key from reference', async () => {
      const mockResponse = {
        id: 'txn_abc123',
        status: WompiTransactionStatus.APPROVED,
        amountInCents: 150000,
        currency: 'COP',
        reference: 'TXN-123',
        customerEmail: 'test@example.com',
        createdAt: '2024-01-15T10:30:00.000Z',
      };

      mockWompiClient.createTransaction.mockResolvedValue(mockResponse);

      const service = new WompiService(mockWompiClient as any);
      await service.authorizePayment(authorizeInput);

      expect(mockWompiClient.createTransaction).toHaveBeenCalledWith(
        expect.any(Object),
        'TXN-123',
      );
    });
  });

  describe('sanitizeError (private method tested via logging)', () => {
    it('masks card numbers in error responses', async () => {
      const errorWithCard = {
        response: {
          status: 400,
          data: {
            message: 'Invalid card',
            card: { number: '4242424242424242' },
          },
        },
      };

      const service = new WompiService(mockWompiClient as any);
      // Access private method via type assertion for testing
      const sanitized = (service as any).sanitizeError(errorWithCard);
      expect(sanitized).toContain('************4242');
      expect(sanitized).not.toContain('4242424242424242');
    });

    it('handles non-object errors', () => {
      const service = new WompiService(mockWompiClient as any);
      const sanitized = (service as any).sanitizeError('simple string error');
      expect(sanitized).toBe('simple string error');
    });

    it('handles null/undefined errors', () => {
      const service = new WompiService(mockWompiClient as any);
      expect((service as any).sanitizeError(null)).toBe('null');
      expect((service as any).sanitizeError(undefined)).toBe('undefined');
    });
  });
});

// Keep existing tests for maskCard and mapper functions
describe('maskCard', () => {
  it('masks full card number showing only last 4', () => {
    expect(maskCard('4242424242424242')).toBe('************4242');
    expect(maskCard('4111 1111 1111 1111')).toBe('************1111');
  });

  it('handles short numbers', () => {
    expect(maskCard('123')).toBe('***');
    expect(maskCard('')).toBe('');
  });

  it('strips non-digits before masking', () => {
    expect(maskCard('4242-4242-4242-4242')).toBe('************4242');
  });
});