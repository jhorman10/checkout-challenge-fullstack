import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { withRetry, RetryOptions } from '../shared/retry.js';
import { maskCard } from '../shared/redact.js';
import {
  WompiTransactionRequest,
  WompiTransactionResponse,
  WompiCardDto,
} from './dto/wompi.dto.js';

/** Error returned by WompiClient when the provider fails. */
export class WompiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly providerMessage: string;

  constructor(message: string, status: number, code: string, providerMessage: string) {
    super(message);
    this.name = 'WompiError';
    this.status = status;
    this.code = code;
    this.providerMessage = providerMessage;
  }
}

/**
 * Low-level HTTP client for Wompi sandbox API.
 *
 * Handles:
 * - Bearer token authentication
 * - Idempotency keys on mutating requests
 * - Retry with exponential backoff on transient failures
 * - Request/response logging with card redaction
 * - 10 second timeout
 */
@Injectable()
export class WompiClient {
  private readonly logger = new Logger(WompiClient.name);
  private readonly client: AxiosInstance;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout = 10000;
  private readonly retryOptions: RetryOptions = {
    attempts: 3,
    delayMs: 250,
    retryOn: [429, 502, 503, 504],
    jitter: true,
    onRetry: (error, attempt, delay) => {
      this.logger.warn(`Retrying Wompi request (attempt ${attempt}/3) after ${Math.round(delay)}ms: ${this.sanitizeError(error)}`);
    },
  };

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('WOMPI_API_KEY') ?? '';
    this.baseUrl = this.configService.get<string>('WOMPI_BASE_URL', 'https://sandbox.wompi.co/v1');

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    // Request interceptor for logging
    this.client.interceptors.request.use((config) => {
      const sanitized = this.sanitizeRequest(config.data);
      this.logger.debug(`Wompi request: ${config.method?.toUpperCase()} ${config.url}`, sanitized);
      return config;
    });

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        this.logger.debug(`Wompi response: ${response.status} ${response.config.url}`, this.sanitizeResponse(response.data));
        return response;
      },
      (error) => {
        this.logger.warn(`Wompi error: ${error.response?.status ?? 'network'} ${error.config?.url}`, this.sanitizeError(error));
        return Promise.reject(error);
      },
    );
  }

  /**
   * Creates a transaction in Wompi.
   *
   * @param request - Transaction request data
   * @param idempotencyKey - Unique key to prevent duplicate charges (typically the transaction reference)
   * @returns Wompi transaction response
   */
  async createTransaction(
    request: WompiTransactionRequest,
    idempotencyKey: string,
  ): Promise<WompiTransactionResponse> {
    const headers = {
      'X-Idempotency-Key': idempotencyKey,
    };

    return withRetry(
      async () => {
        const response = await this.client.post<WompiTransactionResponse>(
          '/transactions',
          this.buildTransactionPayload(request),
          { headers },
        );
        return response.data;
      },
      this.retryOptions,
    );
  }

  /**
   * Retrieves a transaction from Wompi by ID.
   *
   * @param transactionId - Wompi transaction ID
   * @returns Wompi transaction response
   */
  async getTransaction(transactionId: string): Promise<WompiTransactionResponse> {
    return withRetry(
      async () => {
        const response = await this.client.get<WompiTransactionResponse>(
          `/transactions/${transactionId}`,
        );
        return response.data;
      },
      this.retryOptions,
    );
  }

  /**
   * Builds the payload for Wompi transaction creation.
   *
   * Separates card data from the main payload for cleaner structure.
   */
  private buildTransactionPayload(request: WompiTransactionRequest): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      amount_in_cents: request.amountInCents,
      currency: request.currency,
      reference: request.reference,
      customer_email: request.customerEmail,
      customer_data: request.customerData,
    };

    // Add payment method if provided
    if (request.paymentMethod) {
      if ('token' in request.paymentMethod) {
        payload.payment_method = {
          type: 'CARD',
          token: request.paymentMethod.token,
          installments: request.paymentMethod.installments,
        };
      } else if ('card' in request.paymentMethod) {
        payload.payment_method = {
          type: 'CARD',
          card: this.sanitizeCardForPayload(request.paymentMethod.card),
          installments: request.paymentMethod.installments,
        };
      }
    }

    return payload;
  }

  /** Sanitizes card data for logging (masks PAN). */
  private sanitizeCardForPayload(card: WompiCardDto): Omit<WompiCardDto, 'number'> & { number: string } {
    return {
      ...card,
      number: maskCard(card.number),
    };
  }

  /** Sanitizes request data for logging. */
  private sanitizeRequest(data: unknown): unknown {
    if (!data || typeof data !== 'object') return data;

    const sanitized = { ...data } as Record<string, unknown>;

    // Mask card number in payment_method
    const paymentMethod = sanitized.payment_method as Record<string, unknown> | undefined;
    if (paymentMethod?.card) {
      const card = paymentMethod.card as Record<string, unknown>;
      if (card.number && typeof card.number === 'string') {
        sanitized.payment_method = {
          ...paymentMethod,
          card: {
            ...card,
            number: maskCard(card.number),
          },
        };
      }
    }

    // Mask card number if passed directly
    const card = sanitized.card as Record<string, unknown> | undefined;
    if (card?.number && typeof card.number === 'string') {
      sanitized.card = {
        ...card,
        number: maskCard(card.number),
      };
    }

    return sanitized;
  }

  /** Sanitizes response data for logging. */
  private sanitizeResponse(data: unknown): unknown {
    if (!data || typeof data !== 'object') return data;

    const sanitized = { ...data } as Record<string, unknown>;

    // Mask card last four in payment method extra
    const paymentMethod = sanitized.payment_method as Record<string, unknown> | undefined;
    const extra = paymentMethod?.extra as Record<string, unknown> | undefined;
    if (extra?.lastFour) {
      sanitized.payment_method = {
        ...paymentMethod,
        extra: {
          ...extra,
          lastFour: '****',
        },
      };
    }

    return sanitized;
  }

  /** Sanitizes error for logging. */
  private sanitizeError(error: unknown): string {
    if (!error || typeof error !== 'object') return String(error);

    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    const data = axiosError.response?.data;

    let message = `HTTP ${status ?? 'network error'}`;
    if (data && typeof data === 'object') {
      message += `: ${JSON.stringify(this.sanitizeResponse(data))}`;
    }

    return message;
  }
}