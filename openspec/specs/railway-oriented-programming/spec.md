# Railway-Oriented Programming Specification

## Purpose

Refactor the backend domain services to use the Result/Either pattern — returning
`Result<T, E>` instead of throwing `BadRequestException` or returning boolean flags —
establishing an error taxonomy that separates domain errors from infrastructure failures.

## Functional Requirements

### Requirement: Introduce Result type

The system MUST define a `Result<T, E>` type with `ok(value)` and `err(error)`
constructors and `isOk()` / `isErr()` predicates, placed in
`apps/backend/src/shared/result.ts`.

#### Scenario: Ok result carries a value

- GIVEN a successful operation
- WHEN `Result.ok(value)` is called
- THEN `isOk()` returns `true` and the value is accessible

#### Scenario: Err result carries a typed error

- GIVEN a validation failure
- WHEN `Result.err(error)` is called with a `DomainError`
- THEN `isErr()` returns `true` and the error is accessible

### Requirement: TransactionService returns Result types

The system MUST change `createPendingTransaction()` and `pay()` to return
`Result<TransactionRecord, DomainError>` instead of throwing `BadRequestException`.

#### Scenario: Insufficient stock returns Err

- GIVEN a transaction creation with quantity exceeding stock
- WHEN `createPendingTransaction()` executes
- THEN a `Result` with `isErr()` = true and error code `INSUFFICIENT_STOCK` is returned

#### Scenario: Successful payment returns Ok

- GIVEN valid payment input
- WHEN `pay()` executes
- THEN a `Result` with `isOk()` = true and the approved `TransactionRecord` is returned

### Requirement: WompiService returns Result types

The system MUST change `registerPaymentAttempt()` and `authorizePayment()` to return
`Result<{ success, providerStatus, message }, WompiError>` instead of boolean flags.

#### Scenario: Provider rejection returns Err

- GIVEN Wompi responds with `DECLINED`
- WHEN `authorizePayment()` returns
- THEN the Result is `Err` with a `WompiError` containing the provider status

### Requirement: ProductsService stock operations return Result

The system MUST change `reserveStock()`, `releaseReservedStock()`, and
`completeReservedStock()` to return `Result<Product, DomainError>` instead of
`{ success: boolean; message }` objects.

#### Scenario: Stock reservation failure returns Err

- GIVEN stock is insufficient
- WHEN `reserveStock()` is called
- THEN `Result.Err` is returned with error code `INSUFFICIENT_STOCK`

### Requirement: Establish error taxonomy

The system MUST define a typed error taxonomy with codes: `INSUFFICIENT_STOCK`,
`PRODUCT_NOT_FOUND`, `INVALID_INPUT`, `PAYMENT_DECLINED`, `PROVIDER_ERROR`,
`DUPLICATE_OPERATION`.

#### Scenario: Unknown product maps to NotFound error

- GIVEN a non-existent `productId`
- WHEN `createPendingTransaction()` is called
- THEN the error code is `PRODUCT_NOT_FOUND`

### Requirement: Controllers unwrap Result and map to HTTP

The system MUST unwrap the `Result` in controllers and map `Err` to the appropriate
HTTP status code (400 for domain errors, 502 for provider errors).

#### Scenario: Domain error maps to 400

- GIVEN `createPendingTransaction()` returns `Err(INVALID_INPUT)`
- WHEN the controller unwraps the result
- THEN HTTP 400 is returned with a safe message

## Non-Functional Requirements

### Requirement: No throw for domain errors

The system MUST NOT use `throw new BadRequestException(...)` for business-rule violations;
domain errors MUST be expressed as `Result.Err`.

#### Scenario: No BadRequestException in TransactionService

- GIVEN the refactored `transaction.service.ts`
- WHEN a domain rule is violated
- THEN no `BadRequestException` is thrown — an `Err` Result is returned

## Acceptance Criteria

- [ ] `Result<T, E>` type defined in `apps/backend/src/shared/result.ts`
- [ ] `TransactionService.createPendingTransaction` and `.pay` return `Result`
- [ ] `WompiService` methods return `Result`
- [ ] `ProductsService` stock operations return `Result`
- [ ] Error taxonomy with typed codes defined
- [ ] Controllers unwrap and map Result to HTTP status codes
- [ ] No `throw BadRequestException` remains in domain services

## Constraints

- `tryCatch` helper MAY be used for infrastructure-bound (`async`) calls that may throw
- Domain errors MUST be pure values, not exceptions
- The public API contract (response shapes) MAY change only where the payment-checkout
  delta spec permits

## Dependencies

- `apps/backend/src/transactions/transaction.service.ts` (primary refactor target)
- `apps/backend/src/wompi/wompi.service.ts` (primary refactor target)
- `apps/backend/src/products/products.service.ts` (stock operations)
- `apps/backend/src/transactions/transactions.controller.ts` (Result unwrapping)
- `apps/backend/src/transactions/transaction.service.spec.ts` (tests updated for Result)

## References

- `apps/backend/src/shared/result.ts` (new file)
- `apps/backend/src/transactions/transaction.service.ts`
- `apps/backend/src/wompi/wompi.service.ts`
- `apps/backend/src/products/products.service.ts`
- `apps/backend/src/transactions/transactions.controller.ts`
- `apps/backend/src/transactions/transaction.service.spec.ts`
