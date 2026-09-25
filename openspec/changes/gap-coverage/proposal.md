# Proposal: Close All Wompi Technical Test Evaluation Gaps

## Intent

The Wompi Checkout Challenge project has 8 identified gaps against the technical test rubric. This change systematically closes all gaps to achieve full evaluation compliance: test coverage verification (>80%), real Wompi sandbox API integration, Swagger/Postman documentation, Railway-Oriented Programming adoption, OWASP security hardening, AWS cloud deployment, data model in README, and repository rename compliance.

## Scope

### In Scope
- Run and verify test coverage ≥80% on backend and frontend; add coverage to README
- Replace deterministic mock with real Wompi sandbox API calls using provided credentials
- Generate Swagger/OpenAPI spec and Postman collection; embed in README
- Refactor domain use cases to ROP (Result/Either pattern) replacing exceptions + boolean returns
- Implement OWASP security: Helmet headers, rate limiting (@nestjs/throttler), HTTPS enforcement, secure CORS, cookie hardening
- Configure AWS deployment (S3+CloudFront frontend, ECS/Fargate backend, RDS PostgreSQL, Secrets Manager)
- Move data model from TECHNICAL_SPEC.md into README with Mermaid ER diagram
- Rename repository to remove "Wompi" per test requirements

### Out of Scope
- Production payment processing outside sandbox
- Multi-product cart flows (already out of scope per original spec)
- Full CI/CD pipeline (deployment config only)
- Frontend UI redesign

## Capabilities

### New Capabilities
- `test-coverage-verification`: Coverage reporting, thresholds, CI integration, README badges
- `wompi-real-api-integration`: Sandbox credential config, HTTP client, error mapping, retry logic
- `api-documentation`: OpenAPI/Swagger generation, Postman export, README embedding
- `railway-oriented-programming`: Result/Either types, use case refactoring, error taxonomy
- `owasp-security-hardening`: Security headers, rate limiting, input validation, secrets management
- `aws-cloud-deployment`: Infrastructure as code, container build, secrets injection, DNS/SSL
- `readme-data-model`: Entity relationship diagram, schema documentation in README

### Modified Capabilities
- `payment-checkout`: Payment flow now uses real Wompi API + ROP error handling
- `transaction-management`: Domain logic refactored to ROP, stock operations use Result types

## Approach

1. **Test Coverage**: Configure Vitest coverage for frontend (@vitest/coverage-v8), run both suites, enforce 80% thresholds, add badges to README
2. **Wompi Integration**: Remove mock fallback, enforce `WOMPI_API_KEY` + `WOMPI_ENV=sandbox`, add request/response DTOs, implement idempotency keys, map provider statuses to domain states
3. **API Docs**: Add `@nestjs/swagger` with DTO decorators, generate OpenAPI JSON, create Postman collection via `swagger2postman`, embed both in README
4. **ROP Refactor**: Introduce `Result<T, E>` type, convert `TransactionService` and `WompiService` to return `Result`, eliminate `BadRequestException` for domain errors, use `tryCatch` for infrastructure
5. **Security**: Add `@nestjs/throttler` (100 req/15min general, 5 req/15min auth), Helmet with CSP/HSTS/frame-guard, strict CORS allowlist, secure cookies, env validation at startup
6. **AWS Deployment**: Write Terraform/CDK for ECS Fargate service, ALB, RDS PostgreSQL, S3 static hosting, CloudFront, ACM cert, Secrets Manager for Wompi keys; Docker multi-stage builds
7. **README Data Model**: Copy TECHNICAL_SPEC.md entities to README with Mermaid ER diagram, keep as single source of truth
8. **Repo Rename**: GitHub repo rename to `checkout-challenge-fullstack` (or similar), update all references

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/backend/src/transactions/transaction.service.ts` | Modified | ROP refactor, real Wompi calls, error taxonomy |
| `apps/backend/src/wompi/wompi.service.ts` | Modified | Remove mock, add DTOs, retry/idempotency |
| `apps/backend/src/main.ts` | Modified | Helmet, throttler, CORS, validation pipe |
| `apps/backend/src/app.module.ts` | Modified | Swagger, Throttler, Config validation |
| `apps/backend/package.json` | Modified | New deps: @nestjs/swagger, @nestjs/throttler, helmet, class-validator, zod |
| `apps/frontend/vite.config.ts` | Modified | Vitest coverage config |
| `apps/frontend/package.json` | Modified | @vitest/coverage-v8, test:cov script |
| `docker-compose.yml` | Modified | Production-like env vars, healthchecks |
| `README.md` | Modified | Coverage badges, Swagger/Postman links, data model, deploy info |
| `openspec/specs/payment-checkout/spec.md` | Modified | Delta spec for ROP + real API requirements |
| `terraform/` or `cdk/` (new) | New | AWS infrastructure as code |
| `.github/workflows/` (new) | New | CI/CD with coverage gate, deploy |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Real Wompi sandbox rate limits break tests | Medium | Use test-specific sandbox keys, mock only in CI unit tests |
| ROP refactor introduces regressions | High | Incremental per-file, keep old behavior behind feature flag, full test coverage first |
| AWS deployment complexity exceeds scope | Medium | Start with minimal viable: ECS + RDS + S3; defer advanced networking |
| Coverage <80% on frontend (no config today) | High | Add coverage config early, write missing tests for checkoutSlice + App.tsx |
| Repo rename breaks CI/CD links | Low | Update all references atomically in same PR |

## Rollback Plan

- Git revert on main branch for code changes
- Terraform `destroy` for AWS resources (state preserved)
- Docker Compose unchanged for local dev
- Feature flag `USE_ROP` to toggle new error handling

## Dependencies

- Wompi sandbox credentials (pub_stagtest_..., prv_stagtest_..., UAT_SANDBOX_URL) — provided by test brief
- AWS account with permissions for ECS, RDS, S3, CloudFront, ACM, Secrets Manager
- Domain name for HTTPS/ACM (or use AWS-managed domain)

## Success Criteria

- [ ] Backend coverage ≥80% statements/branches/functions/lines
- [ ] Frontend coverage ≥80% statements/branches/functions/lines
- [ ] Coverage badges visible in README with `npm run test:cov` commands
- [ ] Real Wompi sandbox payment succeeds end-to-end with provided credentials
- [ ] Swagger UI accessible at `/api/docs`, Postman collection downloadable
- [ ] All domain use cases return `Result<T, E>`; no `throw BadRequestException` for business rules
- [ ] Security headers present (CSP, HSTS, X-Frame-Options, etc.), rate limiting active, CORS restricted
- [ ] App deployed to AWS: frontend on S3+CloudFront (HTTPS), backend on ECS Fargate (ALB + HTTPS), DB on RDS
- [ ] Data model with Mermaid ER diagram in README
- [ ] Repository renamed without "Wompi" in name