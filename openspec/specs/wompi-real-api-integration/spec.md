# Wompi Real API Integration Specification

## Purpose

Replace the deterministic mock fallback in `WompiService` with real Wompi sandbox API
calls, typed DTOs, idempotency keys, provider-to-domain status mapping, and retry logic.

## Functional Requirements

### Requirement: Enforce required Wompi credentials at startup

The system MUST validate that `WOMPI_API_KEY` is non-empty and `WOMPI_ENV=sandbox` at
application startup, failing fast if either is absent.

#### Scenario: Application refuses to start without API key

- GIVEN `WOMPI_API_KEY` is unset or empty
- WHEN the NestJS app bootstraps
- THEN the process exits with a configuration error

#### Scenario: Production environment is rejected

- GIVEN `WOMPI_ENV=production`
- WHEN the app starts
- THEN startup fails because only sandbox integration is supported

### Requirement: Remove mock fallback from WompiService

The system MUST remove the deterministic mock response branch in `WompiService` so that
every payment operation performs a real HTTP call to the Wompi sandbox API.

#### Scenario: registerPaymentAttempt always calls the real API

- GIVEN `WOMPI_API_KEY` is set and `WOMPI_ENV=sandbox`
- WHEN `WompiService.registerPaymentAttempt()` is invoked
- THEN an HTTP POST is sent to `{WOMPI_BASE_URL}/transactions` with a Bearer token

### Requirement: Define request and response DTOs

The system MUST define typed DTOs for Wompi API requests and responses, placed in
`apps/backend/src/wompi/dto/`.

#### Scenario: Wompi request body conforms to DTO schema

- GIVEN a `RegisterIntentInput` is provided
- WHEN the DTO is assembled
- THEN the HTTP body contains only fields specified by the Wompi API contract

### Requirement: Map provider statuses to domain states

The system MUST translate Wompi provider response statuses (`APPROVED`, `DECLINED`,
`PENDING`, `ERROR`) into internal domain `TransactionRecord` statuses
(`approved`, `failed`, `pending`).

#### Scenario: APPROVED maps to approved

- GIVEN Wompi returns status `APPROVED`
- WHEN the response is mapped
- THEN the transaction status is set to `approved`

#### Scenario: DECLINED maps to failed with safe message

- GIVEN Wompi returns status `DECLINED`
- WHEN the response is mapped
- THEN the transaction status is set to `failed` and the user sees a generic rejection message

### Requirement: Send idempotency keys on all mutating requests

The system MUST attach an `X-Idempotency-Key` header (derived from the transaction
reference) to every Wompi POST request to prevent duplicate charges on retry.

#### Scenario: Idempotency key is derived from reference

- GIVEN a transaction with `reference = "TXN-123456789-100"`
- WHEN `authorizePayment()` sends the request
- THEN the `X-Idempotency-Key` header equals the reference

### Requirement: Apply retry logic for transient failures

The system MUST retry idempotent Wompi calls on HTTP 429, 502, 503, and 504 with
exponential backoff, up to 3 attempts.

#### Scenario: Transient 503 is retried

- GIVEN the Wompi API responds with HTTP 503
- WHEN the retry policy is applied
- THEN the request is retried up to 3 times with backoff

## Non-Functional Requirements

### Requirement: Never log full card data

The system MUST NOT log card numbers, CVV, or any PANs beyond the last 4 digits.

#### Scenario: Card data is not present in logs

- GIVEN a payment request containing card data
- WHEN the WompiService processes it
- THEN no log line contains the full card number or CVV

## Acceptance Criteria

- [ ] `WOMPI_API_KEY` required; app fails fast when missing
- [ ] Mock fallback removed; real HTTP calls always made in sandbox mode
- [ ] DTOs in `apps/backend/src/wompi/dto/`
- [ ] Provider statuses map to domain states
- [ ] Idempotency keys on all Wompi POSTs
- [ ] Transient failures retried with backoff (≤3 attempts)

## Constraints

- MUST use `WOMPI_ENV=sandbox` only — no production keys
- MUST NOT store raw card data in the transaction record or logs
- Retry MUST only apply to idempotent operations

## Dependencies

- Wompi sandbox credentials (`WOMPI_API_KEY`, `WOMPI_ENV`, `WOMPI_BASE_URL`)
- `@nestjs/axios` / `HttpService` (existing dependency)
- `apps/backend/src/wompi/wompi.service.ts` (remove mock branches)
- `apps/backend/src/transactions/transaction.service.ts` (error mapping)
- `apps/backend/.env.example` (env validation expectations)

## References

- `apps/backend/src/wompi/wompi.service.ts`
- `apps/backend/src/wompi/wompi.module.ts`
- `apps/backend/src/transactions/transaction.service.ts`
- `apps/backend/.env.example`
