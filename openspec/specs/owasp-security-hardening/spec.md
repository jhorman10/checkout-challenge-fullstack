# OWASP Security Hardening Specification

## Purpose

Harden the backend NestJS application against OWASP Top 10 risks by applying security
headers via Helmet, rate limiting via `@nestjs/throttler`, strict CORS allowlisting,
secure cookie configuration, and environment-variable validation at startup.

## Functional Requirements

### Requirement: Apply security headers via Helmet

The system MUST configure Helmet in `main.ts` with Content-Security-Policy, HSTS,
X-Frame-Options (`DENY`), X-Content-Type-Options (`nosniff`), and Referrer-Policy.

#### Scenario: Security headers are present on responses

- GIVEN the app is bootstrapped with Helmet
- WHEN any HTTP response is received
- THEN it includes `Content-Security-Policy`, `Strict-Transport-Security`,
  `X-Frame-Options`, and `X-Content-Type-Options`

#### Scenario: CSP restricts script sources

- GIVEN Helmet CSP is configured
- WHEN the app starts
- THEN `script-src` allows only `self` (no inline, no external origins)

### Requirement: Enforce rate limiting

The system MUST apply `@nestjs/throttler` with 100 requests per 15 minutes globally
and 5 requests per 15 minutes on payment-sensitive endpoints.

#### Scenario: Excessive requests return 429

- GIVEN a client exceeds 100 requests in 15 minutes
- WHEN a subsequent request is made
- THEN HTTP 429 is returned with a `Retry-After` header

#### Scenario: Payment endpoint has stricter limits

- GIVEN a client exceeds 5 payment attempts in 15 minutes
- WHEN another payment request is made
- THEN HTTP 429 is returned

### Requirement: Restrict CORS to allowlist

The system MUST configure CORS with an explicit allowlist of frontend origins instead
of the current permissive `origin: true` setting in `main.ts`.

#### Scenario: Unknown origin is rejected

- GIVEN CORS allowlist contains `https://checkout.example.com`
- WHEN a request arrives from `https://evil.example.com`
- THEN the `Access-Control-Allow-Origin` header is omitted

### Requirement: Configure secure cookies

The system MUST set `Secure`, `HttpOnly`, and `SameSite=Strict` on any session or
auth cookies issued by the application.

#### Scenario: Cookies have secure flags

- GIVEN the app sets a cookie
- WHEN the `Set-Cookie` header is inspected
- THEN it includes `Secure`, `HttpOnly`, `SameSite=Strict`

### Requirement: Validate environment at startup

The system MUST validate required environment variables (`WOMPI_API_KEY`, `PORT`,
`DATABASE_URL`) at startup using Zod, failing fast if any are missing.

#### Scenario: App fails fast on missing env

- GIVEN `WOMPI_API_KEY` is unset
- WHEN the app bootstraps
- THEN it exits with a validation error listing missing variables

### Requirement: Apply global validation pipe

The system MUST enable `ValidationPipe` globally with `whitelist: true` and
`forbidNonWhitelisted: true` to prevent mass assignment.

#### Scenario: Unknown payload fields are rejected

- GIVEN a transaction creation payload with an extra `isAdmin` field
- WHEN the request is processed
- THEN HTTP 400 is returned and the field is stripped

## Non-Functional Requirements

### Requirement: HTTPS enforcement in production

The system SHOULD redirect HTTP to HTTPS or reject non-TLS requests in production.

#### Scenario: HTTP requests are redirected

- GIVEN `NODE_ENV=production`
- WHEN an HTTP request arrives
- THEN a 301 redirect to HTTPS is returned

## Acceptance Criteria

- [ ] Helmet applied with CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- [ ] `@nestjs/throttler` with 100 req/15min global, 5 req/15min payment
- [ ] CORS allowlist replaces `origin: true` in `main.ts`
- [ ] Cookies set with `Secure`, `HttpOnly`, `SameSite=Strict`
- [ ] Zod env validation at startup
- [ ] Global `ValidationPipe` with `whitelist` + `forbidNonWhitelisted`
- [ ] HTTPS enforcement in production

## Constraints

- Helmet CSP MUST NOT break Swagger UI rendering at `/api/docs`
- Rate limits MUST NOT block legitimate local development (configurable)
- Cookie settings apply only to cookies the app explicitly sets (no auth flow exists yet)

## Dependencies

- `helmet` (new dependency)
- `@nestjs/throttler` (new dependency)
- `zod` (already in proposal deps for validation)
- `apps/backend/src/main.ts` (apply Helmet, CORS, ValidationPipe, HTTPS)
- `apps/backend/src/app.module.ts` (register ThrottlerGuard, Config validation)
- `apps/backend/.env.example` (reflect validated variables)
- `apps/backend/package.json` (add deps)

## References

- `apps/backend/src/main.ts`
- `apps/backend/src/app.module.ts`
- `apps/backend/package.json`
- `apps/backend/.env.example`
- `apps/backend/src/transactions/transactions.controller.ts`
