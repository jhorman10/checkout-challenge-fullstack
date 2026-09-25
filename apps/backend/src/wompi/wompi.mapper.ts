import { DomainError, domainError } from '../shared/errors.js';
import { Result, err, ok } from '../shared/result.js';
import { WompiTransactionResponse, WompiTransactionStatus } from './dto/wompi.dto.js';

/**
 * Maps Wompi provider transaction status to internal domain status.
 *
 * Wompi statuses:
 * - APPROVED → 'approved' (success)
 * - DECLINED → 'failed' (payment declined)
 * - PENDING → 'pending' (awaiting confirmation)
 * - ERROR → 'failed' (provider error)
 * - VOIDED → 'failed' (transaction cancelled)
 */
export type DomainTransactionStatus = 'approved' | 'failed' | 'pending';

/** Result of mapping a Wompi response to domain status. */
export interface MappedTransactionResult {
  status: DomainTransactionStatus;
  providerStatus: WompiTransactionStatus;
  error?: DomainError;
}

/**
 * Maps a Wompi transaction response to a domain transaction status.
 *
 * @param wompiResponse - Response from Wompi API
 * @returns Mapped status with optional domain error for failed states
 */
export function mapWompiStatus(wompiResponse: WompiTransactionResponse): MappedTransactionResult {
  const providerStatus = wompiResponse.status;

  switch (providerStatus) {
    case WompiTransactionStatus.APPROVED:
      return {
        status: 'approved',
        providerStatus,
      };

    case WompiTransactionStatus.DECLINED:
      return {
        status: 'failed',
        providerStatus,
        error: domainError('PAYMENT_DECLINED', wompiResponse.message ?? 'Payment was declined by the provider'),
      };

    case WompiTransactionStatus.PENDING:
      return {
        status: 'pending',
        providerStatus,
      };

    case WompiTransactionStatus.ERROR:
      return {
        status: 'failed',
        providerStatus,
        error: domainError('PROVIDER_ERROR', wompiResponse.message ?? 'Payment provider returned an error'),
      };

    case WompiTransactionStatus.VOIDED:
      return {
        status: 'failed',
        providerStatus,
        error: domainError('PAYMENT_DECLINED', 'Transaction was voided'),
      };

    default:
      // Unknown status - treat as provider error for safety
      return {
        status: 'failed',
        providerStatus: WompiTransactionStatus.ERROR,
        error: domainError('PROVIDER_ERROR', `Unknown provider status: ${providerStatus}`),
      };
  }
}

/**
 * Maps a Wompi response to a Result for use in service layer.
 *
 * @param wompiResponse - Response from Wompi API
 * @returns Result with mapped status or domain error
 */
export function mapWompiResponseToResult(wompiResponse: WompiTransactionResponse): Result<MappedTransactionResult, DomainError> {
  const mapped = mapWompiStatus(wompiResponse);

  if (mapped.error) {
    return err(mapped.error);
  }

  return ok(mapped);
}

/**
 * Maps a WompiError (from client) to a DomainError.
 *
 * @param error - WompiClient error
 * @returns DomainError appropriate for the failure type
 */
export function mapWompiErrorToDomainError(error: { status: number; code: string; providerMessage: string }): DomainError {
  // 4xx errors (except 429) are client errors - invalid input
  if (error.status >= 400 && error.status < 500 && error.status !== 429) {
    return domainError('INVALID_INPUT', `Payment request invalid: ${error.providerMessage}`);
  }

  // 429, 5xx are provider errors
  return domainError('PROVIDER_ERROR', `Payment provider unavailable: ${error.providerMessage}`);
}