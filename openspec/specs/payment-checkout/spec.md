# Source of Truth Spec — Payment Checkout Domain

> This spec mirrors the project's `TECHNICAL_SPEC.md` and serves as the canonical
> OpenSpec reference for the payment-checkout change. It is the single source of
> truth that delta specs (in `openspec/changes/{change-name}/specs/`) modify.

## 1. Objective

Build a mobile-first checkout flow that allows a customer to:

1. View a product and stock availability.
2. Enter payment and delivery information.
3. Review the order summary.
4. Complete payment through the Wompi sandbox integration.
5. Receive a final transaction result and return to the product view with updated stock.

The solution includes a React SPA frontend and a TypeScript backend API with persistence,
validation, business logic separated from controllers, and automated tests with
coverage above 80%.

## 2. Stack

| Layer     | Technologies                                                                 |
| --------- | ---------------------------------------------------------------------------- |
| Frontend  | React 19 · Vite 8 · TypeScript 6 · Redux Toolkit 2 · RTL · Vitest · vanilla CSS |
| Backend   | NestJS 12 · TypeScript 6 · PostgreSQL (`pg`) · Vitest · Oxlint · Prettier    |
| Payment   | Wompi sandbox API (Bearer token auth via `@nestjs/axios`)                     |
| Dev ops   | Docker Compose (PostgreSQL 16 + backend + frontend)                          |

## 3. Architecture

Hexagonal (ports/adapters) style: HTTP controllers delegate to domain services,
which call infrastructure adapters. The Wompi integration lives entirely in a
dedicated service so the payment-gateway concern never leaks into business logic.

```
                   Frontend (React + Redux)
                          │  HTTP
                          ▼
┌──────────────────────────────────────────────────┐
│  Backend (NestJS)                                │
│  Controllers ──► Services ──► Adapters           │
│  (HTTP layer)    (domain)    (WompiService,      │
│                                  DatabaseService)│
│  In-memory product catalog & transaction store   │
│  PostgreSQL available via DatabaseService        │
└──────────────────────────────────────────────────┘
```

### Key design decisions

- **Stock reservation lifecycle** — Stock is reserved at transaction creation
  (deducted but not sold). On payment success the reservation is committed. On
  payment failure or rejection, reserved stock is released.
- **In-memory transaction store** — Transactions are kept in a `Map` on the
  `TransactionService` instance. `DatabaseService` is wired and ready but the
  current scope uses the in-process store.
- **Deterministic sandbox fallback** — When `WOMPI_API_KEY` is empty, the
  gateway adapter returns predictable mock responses.
- **Card validation** — Approval in sandbox mode is determined by card-number
  prefix: Visa (`4…`) and Mastercard (`5…`) are approved; all others rejected.

## 4. API Contract

### Public endpoints

| Method | Path                        | Description                                   |
| ------ | --------------------------- | --------------------------------------------- |
| GET    | `/api/products`             | Lists available products with stock           |
| GET    | `/api/products/:id`         | Returns one product                           |
| POST   | `/api/transactions`         | Creates a PENDING transaction                 |
| POST   | `/api/transactions/:id/pay` | Starts Wompi sandbox payment flow             |
| GET    | `/api/transactions/:id`     | Returns transaction details and final status  |
| GET    | `/health`                   | Liveness check                                |

### Transaction states

`pending → processing → approved | rejected | failed`

### Business rules

- A transaction may only be paid if the product stock is sufficient.
- Payment must be processed only once per transaction.
- If payment fails, the transaction is marked `failed` and stock is not consumed.
- If payment succeeds, stock is decremented and delivery is assigned.
- Raw card secrets must not be stored in plaintext.

## 5. Testing Strategy

- Backend: Jest-style unit specs via Vitest + supertest for E2E. Coverage target ≥ 80%.
- Frontend: React Testing Library + Vitest. Component and state-slice tests.
- Coverage command (backend): `npm run test:cov`

## 6. Security

- Environment variables for provider credentials; never commit secrets.
- Encrypt or tokenize sensitive card fields before persistence.
- Validate all user input; prevent mass assignment.
- Rate limiting / abuse prevention on payment endpoints.
- HTTPS and security headers in production.
