import { Injectable, Logger } from '@nestjs/common';
import { Result, ok, tryCatch, isErr } from '../shared/result.js';
import { DomainError, domainError } from '../shared/errors.js';
import { WompiClient, WompiError } from './wompi.client.js';
import { mapWompiResponseToResult, mapWompiErrorToDomainError, MappedTransactionResult } from './wompi.mapper.js';
import { maskCard } from '../shared/redact.js';
import {
  WompiTransactionRequest,
  WompiCustomerDto,
  WompiCardDto,
  WompiCurrency,
} from './dto/wompi.dto.js';

/** Input for registering a payment attempt (intent). */
export interface RegisterIntentInput {
  reference: string;
  amount: number;
  currency: string;
  customer: WompiCustomerDto;
  transactionId: string;
}

/** Input for authorizing a payment with card data. */
export interface AuthorizePaymentInput {
  amount: number;
  reference: string;
  currency: string;
  customer: WompiCustomerDto;
  payment: WompiCardDto;
}

/** Result of a payment authorization. */
export interface PaymentAuthorizationResult {
  mapped: MappedTransactionResult;
  rawProviderStatus: string;
}

@Injectable()
export class WompiService {
  private readonly logger = new Logger(WompiService.name);

  constructor(private readonly wompiClient: WompiClient) {}

  /**
   * Registers a payment attempt with Wompi (creates transaction intent).
   *
   * This is a fire-and-forget call that creates a pending transaction in Wompi
   * for tracking purposes. Returns Result to maintain Railway-Oriented Programming.
   */
  async registerPaymentAttempt(input: RegisterIntentInput): Promise<Result<PaymentAuthorizationResult, DomainError>> {
    const request: WompiTransactionRequest = {
      amountInCents: Math.round(input.amount),
      currency: input.currency as WompiCurrency,
      reference: input.reference,
      customerEmail: input.customer.email,
      customerData: {
        fullName: input.customer.fullName,
        legalId: input.customer.legalId,
        legalIdType: input.customer.legalIdType,
      },
    };

    this.logger.log(`Registering payment attempt for reference ${input.reference}`);

    const clientResult = await tryCatch(
      async () => this.wompiClient.createTransaction(request, input.reference),
      (error) => {
        if (error instanceof WompiError) {
          return mapWompiErrorToDomainError(error);
        }
        this.logger.warn(`Wompi registration failed for ${input.reference}: ${this.sanitizeError(error)}`);
        return domainError('PROVIDER_ERROR', 'Payment provider unavailable');
      },
    );

    if (isErr(clientResult)) {
      return clientResult;
    }

    const response = clientResult.value;
    const mapped = mapWompiResponseToResult(response);

    if (isErr(mapped)) {
      return mapped;
    }

    return ok({
      mapped: mapped.value,
      rawProviderStatus: response.status,
    });
  }

  /**
   * Authorizes a payment with card data.
   *
   * Sends the full card data to Wompi for authorization. Uses idempotency key
   * derived from the transaction reference to prevent duplicate charges on retry.
   * Returns Result with mapped domain status.
   */
  async authorizePayment(input: AuthorizePaymentInput): Promise<Result<PaymentAuthorizationResult, DomainError>> {
    const request: WompiTransactionRequest = {
      amountInCents: Math.round(input.amount),
      currency: input.currency as WompiCurrency,
      reference: input.reference,
      customerEmail: input.customer.email,
      customerData: {
        fullName: input.customer.fullName,
        legalId: input.customer.legalId,
        legalIdType: input.customer.legalIdType,
      },
      paymentMethod: {
        type: 'CARD',
        card: input.payment,
        installments: 1,
      },
    };

    const idempotencyKey = input.reference;
    const maskedCard = maskCard(input.payment.number);

    this.logger.log(`Authorizing payment for reference ${input.reference} with card ${maskedCard}`);

    const clientResult = await tryCatch(
      async () => this.wompiClient.createTransaction(request, idempotencyKey),
      (error) => {
        if (error instanceof WompiError) {
          return mapWompiErrorToDomainError(error);
        }
        this.logger.warn(`Wompi authorization failed for ${input.reference} (card ${maskedCard}): ${this.sanitizeError(error)}`);
        return domainError('PROVIDER_ERROR', 'Payment provider unavailable');
      },
    );

    if (isErr(clientResult)) {
      return clientResult;
    }

    const response = clientResult.value;
    const mapped = mapWompiResponseToResult(response);

    if (isErr(mapped)) {
      return mapped;
    }

    return ok({
      mapped: mapped.value,
      rawProviderStatus: response.status,
    });
  }

  /** Sanitizes error for logging (redacts sensitive data). */
  private sanitizeError(error: unknown): string {
    if (!error || typeof error !== 'object') return String(error);

    const axiosError = error as { response?: { status: number; data?: unknown }; message?: string };
    const status = axiosError.response?.status;
    const data = axiosError.response?.data;

    let message = `HTTP ${status ?? 'network error'}`;
    if (data && typeof data === 'object') {
      // Redact card data from error response
      const sanitized = JSON.stringify(data, (_key, value) => {
        if (typeof value === 'string' && /^\d{13,19}$/.test(value.replace(/\D/g, ''))) {
          return maskCard(value);
        }
        return value;
      });
      message += `: ${sanitized}`;
    }

    return message;
  }
}