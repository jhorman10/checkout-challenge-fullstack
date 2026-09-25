import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { WompiClient, WompiError } from './wompi.client.js';
import { WompiTransactionRequest, WompiTransactionResponse, WompiCardDto } from './dto/wompi.dto.js';
import { maskCard } from '../shared/redact.js';

vi.mock('axios');
vi.mock('@nestjs/config');

describe('WompiClient', () => {
  let client: WompiClient;
  let mockAxiosInstance: any;
  let mockConfigService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAxiosInstance = {
      post: vi.fn(),
      get: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    };

    (axios.create as any).mockReturnValue(mockAxiosInstance);

    mockConfigService = {
      get: vi.fn((key: string, defaultValue?: string) => {
        if (key === 'WOMPI_API_KEY') return 'test-api-key';
        if (key === 'WOMPI_BASE_URL') return 'https://sandbox.wompi.co/v1';
        return defaultValue;
      }),
    };

    client = new WompiClient(mockConfigService);
  });

  describe('constructor', () => {
    it('creates axios instance with correct config', () => {
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://sandbox.wompi.co/v1',
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-api-key',
        },
      });
    });

    it('uses default base URL when not configured', () => {
      const configWithoutUrl = {
        get: vi.fn((key: string) => {
          if (key === 'WOMPI_API_KEY') return 'test-key';
          return undefined;
        }),
      };
      new WompiClient(configWithoutUrl);
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({ baseURL: 'https://sandbox.wompi.co/v1' }),
      );
    });
  });

  describe('createTransaction', () => {
    const request: WompiTransactionRequest = {
      amountInCents: 150000,
      currency: 'COP',
      reference: 'TXN-123',
      customerEmail: 'test@example.com',
      customerData: {
        fullName: 'Juan Perez',
        legalId: '1234567890',
        legalIdType: 'CC',
      },
    };

    it('creates transaction with idempotency key', async () => {
      const mockResponse: WompiTransactionResponse = {
        id: 'txn_abc123',
        status: 'APPROVED',
        amountInCents: 150000,
        currency: 'COP',
        reference: 'TXN-123',
        customerEmail: 'test@example.com',
        createdAt: '2024-01-15T10:30:00.000Z',
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

      const result = await client.createTransaction(request, 'TXN-123');

      expect(result).toEqual(mockResponse);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/transactions',
        expect.objectContaining({
          amount_in_cents: 150000,
          currency: 'COP',
          reference: 'TXN-123',
          customer_email: 'test@example.com',
        }),
        { headers: { 'X-Idempotency-Key': 'TXN-123' } },
      );
    });

    it('includes payment method with token', async () => {
      const requestWithToken: WompiTransactionRequest = {
        ...request,
        paymentMethod: {
          type: 'CARD',
          token: 'tok_123',
          installments: 1,
        },
      };

      mockAxiosInstance.post.mockResolvedValue({ data: { id: 'txn_1', status: 'APPROVED' } });

      await client.createTransaction(requestWithToken, 'TXN-123');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/transactions',
        expect.objectContaining({
          payment_method: expect.objectContaining({
            type: 'CARD',
            token: 'tok_123',
            installments: 1,
          }),
        }),
        { headers: { 'X-Idempotency-Key': 'TXN-123' } },
      );
    });

    it('includes payment method with card', async () => {
      const requestWithCard: WompiTransactionRequest = {
        ...request,
        paymentMethod: {
          type: 'CARD',
          card: {
            number: '4242424242424242',
            expMonth: '12',
            expYear: '2028',
            cvv: '123',
          },
          installments: 1,
        },
      };

      mockAxiosInstance.post.mockResolvedValue({ data: { id: 'txn_1', status: 'APPROVED' } });

      await client.createTransaction(requestWithCard, 'TXN-123');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/transactions',
        expect.objectContaining({
          payment_method: expect.objectContaining({
            type: 'CARD',
            card: expect.objectContaining({
              number: '************4242',
            }),
          }),
        }),
        { headers: { 'X-Idempotency-Key': 'TXN-123' } },
      );
    });

    it('retries on transient errors', async () => {
      const mockResponse: WompiTransactionResponse = {
        id: 'txn_abc123',
        status: 'APPROVED',
        amountInCents: 150000,
        currency: 'COP',
        reference: 'TXN-123',
        customerEmail: 'test@example.com',
        createdAt: '2024-01-15T10:30:00.000Z',
      };

      mockAxiosInstance.post
        .mockRejectedValueOnce({ response: { status: 503 } })
        .mockRejectedValueOnce({ response: { status: 503 } })
        .mockResolvedValue({ data: mockResponse });

      const result = await client.createTransaction(request, 'TXN-123');

      expect(result).toEqual(mockResponse);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(3);
    });

    it('throws axios error on 4xx errors', async () => {
      const axiosError = {
        response: { status: 400, data: { message: 'Invalid request' } },
        config: { url: '/transactions' },
        isAxiosError: true,
      };
      mockAxiosInstance.post.mockRejectedValue(axiosError);

      await expect(client.createTransaction(request, 'TXN-123')).rejects.toEqual(
        expect.objectContaining({
          response: expect.objectContaining({ status: 400 }),
        }),
      );
    });

it('throws axios error on 5xx errors after retries exhausted', async () => {
      const axiosError = {
        response: { status: 503, data: { message: 'Service unavailable' } },
        config: { url: '/transactions' },
        isAxiosError: true,
      };
      mockAxiosInstance.post.mockRejectedValue(axiosError);

      await expect(client.createTransaction(request, 'TXN-123')).rejects.toEqual(
        expect.objectContaining({
          response: expect.objectContaining({ status: 503 }),
        }),
      );
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(3);
    });
  });

  describe('getTransaction', () => {
    it('retrieves transaction by ID', async () => {
      const mockResponse: WompiTransactionResponse = {
        id: 'txn_abc123',
        status: 'APPROVED',
        amountInCents: 150000,
        currency: 'COP',
        reference: 'TXN-123',
        customerEmail: 'test@example.com',
        createdAt: '2024-01-15T10:30:00.000Z',
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockResponse });

      const result = await client.getTransaction('txn_abc123');

      expect(result).toEqual(mockResponse);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/transactions/txn_abc123');
    });

    it('retries on transient errors', async () => {
      const mockResponse: WompiTransactionResponse = {
        id: 'txn_abc123',
        status: 'APPROVED',
        amountInCents: 150000,
        currency: 'COP',
        reference: 'TXN-123',
        customerEmail: 'test@example.com',
        createdAt: '2024-01-15T10:30:00.000Z',
      };

      mockAxiosInstance.get
        .mockRejectedValueOnce({ response: { status: 502 } })
        .mockResolvedValue({ data: mockResponse });

      const result = await client.getTransaction('txn_abc123');

      expect(result).toEqual(mockResponse);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('sanitizeCardForPayload', () => {
    it('masks card number in payload', () => {
      const card: WompiCardDto = {
        number: '4242424242424242',
        expMonth: '12',
        expYear: '2028',
        cvv: '123',
      };

      const sanitized = (client as any).sanitizeCardForPayload(card);
      expect(sanitized.number).toBe('************4242');
      expect(sanitized.expMonth).toBe('12');
      expect(sanitized.expYear).toBe('2028');
      expect(sanitized.cvv).toBe('123');
    });
  });

  describe('sanitizeRequest', () => {
    it('masks card number in payment_method.card', () => {
      const data = {
        payment_method: {
          card: { number: '4242424242424242', expMonth: '12', expYear: '2028', cvv: '123' },
        },
      };

      const sanitized = (client as any).sanitizeRequest(data);
      expect(sanitized.payment_method.card.number).toBe('************4242');
    });

    it('masks card number in direct card field', () => {
      const data = {
        card: { number: '4242424242424242', expMonth: '12', expYear: '2028', cvv: '123' },
      };

      const sanitized = (client as any).sanitizeRequest(data);
      expect(sanitized.card.number).toBe('************4242');
    });

    it('handles non-object data', () => {
      expect((client as any).sanitizeRequest('string')).toBe('string');
      expect((client as any).sanitizeRequest(null)).toBe(null);
      expect((client as any).sanitizeRequest(undefined)).toBe(undefined);
    });
  });

  describe('sanitizeResponse', () => {
    it('masks lastFour in payment method extra', () => {
      const data = {
        payment_method: {
          extra: { lastFour: '4242', brand: 'VISA' },
        },
      };

      const sanitized = (client as any).sanitizeResponse(data);
      expect(sanitized.payment_method.extra.lastFour).toBe('****');
      expect(sanitized.payment_method.extra.brand).toBe('VISA');
    });

    it('handles non-object data', () => {
      expect((client as any).sanitizeResponse('string')).toBe('string');
    });
  });

  describe('sanitizeError', () => {
    it('formats axios error with status', () => {
      const error = {
        response: { status: 400, data: { message: 'Bad request' } },
      };

      const sanitized = (client as any).sanitizeError(error);
      expect(sanitized).toBe('HTTP 400: {"message":"Bad request"}');
    });

    it('handles network errors without response', () => {
      const error = { message: 'Network error' };
      const sanitized = (client as any).sanitizeError(error);
      expect(sanitized).toBe('HTTP network error');
    });
  });
});

// Keep existing maskCard tests
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