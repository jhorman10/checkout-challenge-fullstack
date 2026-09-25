# Implementation Tasks — gap-coverage

**Change**: gap-coverage
**Design**: `openspec/changes/gap-coverage/design.md`
**Specs**: `openspec/specs/{test-coverage-verification, wompi-real-api-integration, api-documentation, railway-oriented-programming, owasp-security-hardening, aws-cloud-deployment, readme-data-model}/spec.md`

## Review Workload Forecast

- **Total tasks**: 35
- **Estimated changed lines**: ~1,250 (backend: 900, frontend: 150, infra: 200)
- **400-line budget risk**: High — each phase maps to one PR; the largest PR is Phase 4 (Security, ~250 lines) but the cumulative total exceeds 400.
- **Chained PRs recommended**: Yes — 7 phases = 7 reviewable PRs.

## Phases

### Phase 1 — Foundation (P0)

| # | Task | Type | Priority | Affected files | Acceptance criteria |
|---|------|------|----------|----------------|---------------------|
| 1 | [x] Add `shared/result.ts` | feat | P0 | `apps/backend/src/shared/result.ts` | `Result<T,E>`, `ok()`, `err()`, `isOk()`, `isErr()`, `map()`, `tryCatch()` — all covered by unit tests |
| 2 | [x] Add `shared/errors.ts` | feat | P0 | `apps/backend/src/shared/errors.ts` | `DomainError` union, `ErrorCode`, `toHttpStatus()` returns 400/402/404/409/502 |
| 3 | [x] Add `shared/retry.ts` + `shared/redact.ts` | feat | P0 | `apps/backend/src/shared/retry.ts`, `apps/backend/src/shared/redact.ts` | `withRetry` retries on 429/502/503/504 with jitter; `maskCard` returns last-4 only |

### Phase 2 — ROP refactor (P0)

| # | Task | Type | Priority | Affected files | Acceptance criteria |
|---|------|------|----------|----------------|---------------------|
| 4 | [x] Unit tests for `Result` and error taxonomy | test | P0 | `apps/backend/src/shared/result.spec.ts`, `apps/backend/src/shared/errors.spec.ts`, `apps/backend/src/shared/retry.spec.ts`, `apps/backend/src/shared/redact.spec.ts`, `apps/backend/src/products/products.service.spec.ts` | 100% coverage of shared utilities |
| 5 | [x] Refactor `ProductsService` stock ops to `Result` | refactor | P0 | `apps/backend/src/products/products.service.ts` | `reserveStock`, `releaseReservedStock`, `completeReservedStock` return `Result<Product, DomainError>` |
| 6 | [x] Refactor `TransactionService` to `Result` | refactor | P0 | `apps/backend/src/transactions/transaction.service.ts` | `createPendingTransaction` and `pay` return `Result`; `BadRequestException` removed |
| 7 | [x] Update `transaction.service.spec.ts` for `Result` returns | test | P0 | `apps/backend/src/transactions/transaction.service.spec.ts` | Tests assert `isErr()`/`isOk()` instead of thrown exceptions |
| 8 | [x] Unwrap `Result` in controllers | refactor | P0 | `apps/backend/src/transactions/transactions.controller.ts`, `apps/backend/src/products/products.controller.ts` | Controllers map `Result` to HTTP via `toHttpStatus()`; 404 on missing product |
| 9 | [x] Assert no `throw new BadRequestException` remains in `src/` | test | P1 | CI lint job | Grep assertion in CI pipeline |

### Phase 3 — Wompi real API (P0)

| # | Task | Type | Priority | Affected files | Acceptance criteria |
|---|------|------|----------|----------------|---------------------|
| 10 | Add zod env validation | feat | P0 | `apps/backend/src/config/env.validation.ts`, `apps/backend/src/app.module.ts` | Missing `WOMPI_API_KEY` aborts boot with exit code 1 |
| 11 | Create Wompi DTOs | feat | P0 | `apps/backend/src/wompi/dto/` | `WompiTransactionRequest`, `WompiTransactionResponse`, `WompiCustomerDto`, `WompiCardDto` |
| 12 | Create `wompi.client.ts` | feat | P0 | `apps/backend/src/wompi/wompi.client.ts` | Bearer auth, `X-Idempotency-Key` header, `withRetry`, 10s timeout |
| 13 | Create `wompi.mapper.ts` | feat | P0 | `apps/backend/src/wompi/wompi.mapper.ts` | APPROVED→approved, DECLINED→failed, PENDING→pending, ERROR→failed |
| 14 | Strip mock branches from `WompiService` | refactor | P0 | `apps/backend/src/wompi/wompi.service.ts`, `apps/backend/src/wompi/wompi.module.ts` | No mock fallback; delegates to `WompiClient`; returns `Result` |
| 15 | Backend tests: mapping, idempotency, retry, redaction | test | P0 | `apps/backend/src/wompi/wompi.service.spec.ts` | Idempotency header present; 503 retried then 200; card PAN never in logs |

### Phase 4 — Security hardening (P0)

| # | Task | Type | Priority | Affected files | Acceptance criteria |
|---|------|------|----------|----------------|---------------------|
| 16 | Helmet + strict CSP | feat | P0 | `apps/backend/src/main.ts` | Security headers present; scoped CSP bypass for `/api/docs*` only |
| 17 | CORS allowlist | feat | P0 | `apps/backend/src/main.ts`, `apps/backend/.env.example` | Unknown origin rejected; `CORS_ORIGINS` env var |
| 18 | Global `ValidationPipe` | feat | P0 | `apps/backend/src/main.ts` | `whitelist` + `forbidNonWhitelisted`; extra fields return 400 |
| 19 | `ThrottlerModule` + guard | feat | P0 | `apps/backend/src/app.module.ts` | 5 req/15min on payment routes; 429 after limit |
| 20 | Secure cookies + HTTPS redirect | feat | P0 | `apps/backend/src/main.ts` | `sameSite`, `secure`, `httpOnly`; redirect to HTTPS in prod |
| 21 | E2E security tests | test | P0 | `apps/backend/test/security.e2e-spec.ts` | Header presence, CORS rejection, 429, mass-assignment rejection |

### Phase 5 — API documentation (P1)

| # | Task | Type | Priority | Affected files | Acceptance criteria |
|---|------|------|----------|----------------|---------------------|
| 22 | Swagger setup | feat | P1 | `apps/backend/src/main.ts` | `/api/docs` UI and `/api/docs-json` available |
| 23 | Decorate controllers + DTOs | feat | P1 | All controllers, all DTOs | `@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiProperty` on all routes |
| 24 | Generate `openapi.json` + Postman | feat | P1 | `apps/backend/package.json`, `docs/postman_collection.json`, `apps/backend/openapi.json` | `docs:postman` script committed; collection covers all 5 routes |
| 25 | OpenAPI drift test | test | P1 | `apps/backend/test/openapi.e2e-spec.ts` | CI fails if committed `openapi.json` diverges from live decorators |

### Phase 6 — Test coverage gate (P0)

| # | Task | Type | Priority | Affected files | Acceptance criteria |
|---|------|------|--------------------------|---------------------|
| 26 | Frontend Vitest config | feat | P0 | `apps/frontend/vite.config.ts`, `apps/frontend/package.json` | jsdom env, setup file, `@vitest/coverage-v8`, 80% thresholds, `test:cov` script |
| 27 | Add missing frontend tests | test | P0 | `apps/frontend/src/test/setup.ts`, `apps/frontend/src/store/cartSlice.test.ts`, `apps/frontend/src/App.test.tsx` | `App.tsx` ≥80% lines; `cartSlice` ≥80%; all 5 checkout steps tested |
| 28 | Backend coverage thresholds | feat | P0 | `apps/backend/vitest.config.ts` | 80% thresholds on statements/branches/functions/lines |
| 29 | CI workflow | feat | P0 | `.github/workflows/ci.yml` | Runs backend + frontend `test:cov`; fails below 80%; lint + typecheck + build |

### Phase 7 — Docs & infrastructure (P1)

| # | Task | Type | Priority | Affected files | Acceptance criteria |
|---|------|------|----------|----------------|---------------------|
| 30 | README data model | docs | P1 | `README.md` | Mermaid `erDiagram` + entity table + business rules + transaction states |
| 31 | README badges + deprecation notice | docs | P1 | `README.md`, `TECHNICAL_SPEC.md` | Coverage/lint badges; TECHNICAL_SPEC §5 superseded pointer |
| 32 | Multi-stage Dockerfiles | infra | P1 | `apps/backend/Dockerfile`, `apps/frontend/Dockerfile` | `builder` + `runtime` stages; non-root user; `npm ci --omit=dev` |
| 33 | Terraform: backend infra | infra | P1 | `terraform/vpc.tf`, `terraform/ecs.tf`, `terraform/alb.tf`, `terraform/rds.tf`, `terraform/secrets.tf` | `terraform validate` passes; no plaintext Wompi keys |
| 34 | Terraform: frontend infra | infra | P1 | `terraform/s3.tf`, `terraform/cloudfront.tf` | Private bucket + OAI; HTTPS only; custom error responses |
| 35 | CI: terraform + OpenAPI drift | ci | P1 | `.github/workflows/ci.yml` | `terraform validate` + `terraform fmt -check`; OpenAPI drift gate |

---

## Next Recommended Phase

**`sdd-apply`** — begin with Phase 1 (shared primitives), since all downstream work depends on the `Result` type and error taxonomy.

## Risks

- **Frontend coverage gate failure** — `App.tsx` has 570 lines and only 2 tests. Task 27 must add tests *before* the 80% threshold is enforced (tasks 26 → 27 ordered correctly).
- **ROP HTTP status changes** — `pay` returns 200 today; ROP proposes 201. `GET /transactions/:id` returns 200 null; ROP proposes 404. Client-visible break; flag as open question.
- **Wompi sandbox credentials** — Must use the sandbox keys from the test brief. Task 10's zod validation will enforce `WOMPI_ENV === "sandbox"`.
