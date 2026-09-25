# Design: Close All Wompi Technical Test Evaluation Gaps

## Technical Approach

Seven capabilities, one backend. Work lands bottom-up in dependency order: `shared/` primitives → ROP refactor → Wompi real API → security+docs at the HTTP edge → coverage gate → README → Terraform. Frontend changes are limited to Vitest coverage wiring.

```
                    ┌──────── HTTP edge (main.ts) ────────┐
  Browser  ─HTTP──► │ Helmet · CORS allowlist · Throttler  │
                    │ ValidationPipe · Swagger /api/docs   │
                    └──────────────┬─────────────────────┘
                                   ▼
   ┌───────────────────────────────────────────────────────────┐
   │ Controllers   unwrap Result ─► HttpExceptionFactory        │
   ├───────────────────────────────────────────────────────────┤
   │ Domain        TransactionService · ProductsService        │
   │               return Result<T, DomainError>  (no throw)   │
   ├───────────────────────────────────────────────────────────┤
   │ Ports         shared/result.ts · shared/errors.ts          │
   ├───────────────────────────────────────────────────────────┤
   │ Adapters      WompiService ─► WompiClient ─► axios        │
   │               DatabaseService ─► pg Pool (RDS)            │
   └───────────────────────────────────────────────────────────┘
```

## Architecture Decisions

| # | Option | Tradeoff | Decision |
|---|--------|----------|----------|
| 1 | `neverthrow` vs hand-rolled union | dep+types vs 40 LOC | **Hand-rolled** `Result<T,E>` in `shared/result.ts` — repo uses zero runtime utility deps; full control over narrowing |
| 2 | Per-controller `if (r.isErr()) throw` vs global interceptor | duplicated vs magic | **Explicit unwrap in controllers** via `HttpExceptionFactory.fromResult()` — readable, Swagger-friendly, no interceptor magic |
| 3 | Throwing vs `Result` for domain errors | — | **Result for domain**, `tryCatch` helper only around `axios`/`pg` (infrastructure that actually throws) |
| 4 | `axios-retry` vs in-house | dep vs 25 LOC | **In-house `withRetry`** in `shared/retry.ts` — needs only 429/502/503/504 + jitter, not the full library surface |
| 5 | zod standalone vs `@nestjs/config` `validate` | — | **zod via `ConfigModule.forRoot({ validate })`** — one schema, typed `ConfigService` |
| 6 | Helmet CSP global vs bypass for docs | CSP breaks Swagger UI | **Scoped CSP bypass middleware** for `/api/docs*` only; global CSP stays strict (`script-src 'self'`) |
| 7 | Terraform vs CDK | declarative+stateless vs TS-native | **Terraform (HCL)** under `terraform/` — no Node toolchain in the infra path, plan/apply reviewable in PR |
| 8 | Frontend `vite.config.ts` vs new `vitest.config.ts` | split config | **Put `test` block in `vite.config.ts`** using `defineConfig` from `vitest/config` — single source, no plugin duplication |

## Data Flow — payment happy path

```
Client → POST /api/transactions
  → ValidationPipe(whitelist)  → 400 on extra fields
  → TransactionService.createPendingTransaction()
      → ProductsService.reserveStock()  ──Err──► 400 INSUFFICIENT_STOCK
      → Ok(TransactionRecord pending) + fire-and-forget registerPaymentAttempt(reference)
Client → POST /api/transactions/:id/pay
  → TransactionService.pay()
      → WompiService.authorizePayment()
          → WompiClient POST /transactions  (Bearer, X-Idempotency-Key: reference)
              → 503 ×3 → withRetry backoff 250/500/1000ms → Err(PROVIDER_ERROR)
              → 200 {status:"APPROVED"}  → Ok({providerStatus:"APPROVED"})
          → status mapper: APPROVED→approved | DECLINED→failed | PENDING→pending | ERROR→failed
      → Err(PAYMENT_DECLINED) ⇒ releaseReservedStock() + failed ⇒ HTTP 402
      → Ok(approved)        ⇒ completeReservedStock() + approved ⇒ HTTP 201
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/backend/src/shared/result.ts` | Create | `Result<T,E>`, `ok()`, `err()`, `isOk()`, `isErr()`, `map()`, `tryCatch()` |
| `apps/backend/src/shared/errors.ts` | Create | `DomainError` union + `ErrorCode` + `toHttpStatus()` (400/402/404/409/502) |
| `apps/backend/src/shared/retry.ts` | Create | `withRetry(fn, {attempts:3, retryOn:[429,502,503,504]})` |
| `apps/backend/src/shared/redact.ts` | Create | `maskCard()` → last-4 only; used by every logger |
| `apps/backend/src/config/env.validation.ts` | Create | zod schema: `WOMPI_API_KEY` non-empty, `WOMPI_ENV==='sandbox'`, `PORT`, `DATABASE_URL` |
| `apps/backend/src/wompi/dto/*.ts` | Create | `WompiTransactionRequest`, `WompiTransactionResponse`, `WompiCustomerDto`, `WompiCardDto` |
| `apps/backend/src/wompi/wompi.client.ts` | Create | Raw HTTP port: axios POST, Bearer auth, idempotency header, `withRetry` |
| `apps/backend/src/wompi/wompi.mapper.ts` | Create | Provider status → `TransactionRecord['status']` |
| `apps/backend/src/wompi/wompi.service.ts` | Modify | Delete both mock branches; delegate to `WompiClient`; return `Result` |
| `apps/backend/src/wompi/wompi.module.ts` | Modify | Export client, provide `WOMPI_*` via validated config |
| `apps/backend/src/transactions/transaction.service.ts` | Modify | `Result` returns; drop `BadRequestException`; drop local card-prefix gate |
| `apps/backend/src/transactions/dto/*.ts` | Create | `CreateTransactionDto`, `PayTransactionDto` (class-validator) |
| `apps/backend/src/transactions/transactions.controller.ts` | Modify | `@ApiTags/@ApiOperation/@ApiResponse`; unwrap via `HttpExceptionFactory`; `@Throttle` 5/15min |
| `apps/backend/src/products/products.service.ts` | Modify | Stock ops return `Result<Product, DomainError>` |
| `apps/backend/src/products/products.controller.ts` | Modify | Decorators; 404 on missing product |
| `apps/backend/src/main.ts` | Modify | Helmet, CORS allowlist, global `ValidationPipe`, Swagger, HTTPS redirect in prod |
| `apps/backend/src/app.module.ts` | Modify | `ConfigModule.forRoot({validate})`, `ThrottlerModule`, `APP_GUARD ThrottlerGuard` |
| `apps/backend/package.json` | Modify | Scripts `docs:postman`; deps listed below |
| `apps/backend/vitest.config.ts` | Modify | `coverage: {provider:'v8', thresholds:{80}}` |
| `apps/backend/.env.example` | Modify | `CORS_ORIGINS`, `RATE_LIMIT_*`; Wompi key documented as required |
| `apps/backend/Dockerfile` | Modify | Multi-stage: `builder` (nest build) → `runtime` (`npm ci --omit=dev`, non-root) |
| `apps/frontend/vite.config.ts` | Modify | `test` block: jsdom, setup file, v8 coverage, 80 thresholds |
| `apps/frontend/package.json` | Modify | `test`, `test:cov` scripts; dev deps |
| `apps/frontend/src/test/setup.ts` | Create | jest-dom matchers |
| `apps/frontend/src/store/cartSlice.test.ts` | Create | Missing coverage for cart reducer |
| `.github/workflows/ci.yml` | Create | Backend + frontend `test:cov` gate, oxlint, tsc, build |
| `docs/postman_collection.json` | Create | Generated v2.1 collection (committed artifact) |
| `apps/backend/openapi.json` | Create | Generated on build from live decorators |
| `terraform/*.tf` | Create | VPC, ECR, ECS Fargate, ALB+ACM, RDS, S3+OAI+CloudFront+ACM, Secrets Manager |
| `README.md` | Modify | Badges, Data Model (Mermaid `erDiagram`), doc links, deploy section |
| `TECHNICAL_SPEC.md` | Modify | §5 replaced with pointer to README (no divergence) |
| `docker-compose.yml` | Modify | `CORS_ORIGINS`, real `WOMPI_API_KEY` passthrough, healthchecks |

**New dependencies** — backend prod: `@nestjs/swagger`, `@nestjs/throttler`, `helmet`, `class-validator`, `class-transformer`, `zod`. Backend dev: `swagger2postman`. Frontend dev: `@vitest/coverage-v8` (match vitest ^5 major). No infra runtime deps.

## Error Handling Strategy

| Layer | Mechanism | Status |
|-------|-----------|--------|
| Env | zod `parse` in `ConfigModule` | process exit 1 |
| Domain | `Result.Err(DomainError)` | `toHttpStatus()` → 400/402/404/409 |
| Provider | `Result.Err(WompiError)` | 502 (`PROVIDER_ERROR`), 402 (`PAYMENT_DECLINED`) |
| HTTP client | axios throws → `tryCatch` → `Err` | never escapes as 500 |
| Transport | Throttler / Helmet / ValidationPipe | 429 / headers / 400 |
| Unknown | Nest default filter + global filter masking internals | 500 generic message |

Never logged: card number beyond last 4, CVV, `WOMPI_API_KEY`. Enforced by `redact.ts` and a test that greps log output.

## Testing Strategy

| Capability | Layer | What |
|---|---|---|
| test-coverage-verification | config | Both `test:cov` exit non-zero below 80; assert threshold objects exist |
| wompi-real-api-integration | unit + integration | `WompiClient` with `nock`/mocked axios: status mapping, idempotency header, retry on 503 then 200, 4xx no-retry |
| api-documentation | e2e | `GET /api/docs-json` returns OpenAPI 3 with all 5 routes; CI diff-checks committed `openapi.json` |
| railway-oriented-programming | unit | `Result` predicates/map/tryCatch; each error code path; controllers map to 400/404/502 |
| owasp-security-hardening | e2e | Helmet headers present; CORS omits unknown origin; 429 after limit; 400 on extra payload field; missing env aborts boot |
| aws-cloud-deployment | static | `terraform validate` + `tfsort` in CI; `terraform plan` never references plaintext key |
| readme-data-model | static | Mermaid block lints; entity field list diffed against TS interfaces in CI |

Frontend gap: `App.tsx` (570 lines) and `cartSlice.ts` are the coverage risk — add tests before the threshold is enforced, otherwise the gate fails on day one.

## Migration / Rollout

No data migration (in-memory store, RDS is new). Sequence: shared primitives → ROP (tests green at each step) → Wompi real API → security → docs → coverage gate → README → Terraform. Each maps to one PR; no feature flag needed because the API surface change is limited to error status codes, which `payment-checkout` permits.

## Implementation Tasks (for sdd-tasks)

**Phase 1 — Foundation**
1. Add `shared/result.ts` with `Result`, `ok`, `err`, `isOk`, `isErr`, `map`, `tryCatch`
2. Add `shared/errors.ts` with error codes and `toHttpStatus()`
3. Add `shared/retry.ts` (`withRetry`) and `shared/redact.ts` (`maskCard`)

**Phase 2 — ROP refactor**
4. Unit tests for `Result` and error taxonomy
5. Refactor `ProductsService` stock ops to `Result`
6. Refactor `TransactionService` to `Result`, remove `BadRequestException`
7. Update `transaction.service.spec.ts` for `Result` returns
8. Unwrap `Result` in `TransactionsController` + `ProductsController` with HTTP status mapping
9. Assert no `throw new BadRequestException` remains in `src/`

**Phase 3 — Wompi real API**
10. Add zod env validation and wire into `ConfigModule`
11. Create Wompi request/response DTOs
12. Create `wompi.client.ts` (Bearer, `X-Idempotency-Key`, `withRetry`, timeout)
13. Create `wompi.mapper.ts` provider→domain status mapping
14. Strip mock branches from `WompiService`; return `Result`; redact logs
15. Backend tests: mapping, idempotency, retry, no-PAN-in-logs

**Phase 4 — Security**
16. Helmet + strict CSP in `main.ts` with `/api/docs` scoped bypass
17. CORS allowlist from env, replacing `origin: true`
18. Global `ValidationPipe` with `whitelist` + `forbidNonWhitelisted`
19. `ThrottlerModule` + `APP_GUARD`, 5/15min on payment routes
20. Secure-cookie defaults and prod HTTPS redirect
21. E2E security tests (headers, CORS, 429, mass-assignment)

**Phase 5 — API docs**
22. Install `@nestjs/swagger`; `DocumentBuilder` in `main.ts`; `/api/docs` + `/api/docs-json`
23. Decorate all controllers and DTOs (`@ApiTags`, `@ApiOperation`, `@ApiProperty`, `@ApiResponse`)
24. Generate `openapi.json` on build; add `docs:postman` script; commit collection
25. E2E test asserting OpenAPI 3 document contains all routes

**Phase 6 — Coverage**
26. Frontend Vitest config: jsdom, setup file, `@vitest/coverage-v8`, 80 thresholds, `test:cov`
27. Add `cartSlice` tests and `App.tsx` step tests until frontend ≥80%
28. Backend `vitest.config.ts` thresholds + exclude bootstrap files
29. `.github/workflows/ci.yml` with coverage gate, lint, typecheck, build

**Phase 7 — Docs & infra**
30. README Data Model section with Mermaid `erDiagram`, states, business rules
31. Mark `TECHNICAL_SPEC.md` §5 as superseded; add badges and doc links to README
32. Multi-stage Dockerfiles for backend and frontend
33. `terraform/` modules: VPC, ECR, ALB+ACM, ECS Fargate, RDS private, Secrets Manager
34. `terraform/` modules: S3 private + OAI + CloudFront + ACM
35. CI job running `terraform validate` and OpenAPI drift check

## Open Questions

- [ ] Sandbox credentials are referenced by secret name, not value — confirm the exact `WOMPI_*` var names the grader supplies before task 12.
- [ ] `GET /api/transactions/:id` currently returns `200 null`; ROP makes it `404`. Acceptable response-shape change?
- [ ] `POST /api/transactions/:id/pay` returns `200` today; ROP proposes `201` on success. Confirm or pin to `200`.
