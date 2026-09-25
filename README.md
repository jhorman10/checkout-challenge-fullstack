# Wompi Checkout Challenge

[![Backend Coverage](https://img.shields.io/badge/backend%20coverage-80%25-brightgreen)](apps/backend/vitest.config.ts)
[![Frontend Coverage](https://img.shields.io/badge/frontend%20coverage-80%25-brightgreen)](apps/frontend/vite.config.ts)
[![Lint](https://img.shields.io/badge/lint-oxlint-blue)](apps/backend/.oxlintrc.json)
[![TypeScript](https://img.shields.io/badge/typescript-strict-blue)](tsconfig.json)

A full-stack checkout flow built for a commerce evaluation challenge. The frontend is a
mobile-first React SPA with a five-step checkout experience; the backend is a NestJS API
that manages products, transactions, stock reservation, and a Wompi sandbox payment
adapter.

## Table of contents

- [Architecture](#architecture)
- [Stack](#stack)
- [Features](#features)
- [Project structure](#project-structure)
- [Local setup](#local-setup)
  - [Option A — Docker Compose (recommended)](#option-a--docker-compose-recommended)
  - [Option B — Run services manually](#option-b--run-services-manually)
  - [Environment variables](#environment-variables)
- [API endpoints](#api-endpoints)
- [Checkout flow](#checkout-flow)
- [Payment adapter](#payment-adapter)
- [Testing](#testing)
- [Styling and responsive design](#styling-and-responsive-design)
- [Deployment notes](#deployment-notes)

---

## Architecture

The system follows a **hexagonal (ports/adapters) style**: HTTP controllers delegate to
domain services, which in turn call infrastructure adapters. The Wompi integration lives
entirely inside a dedicated service so the payment-gateway concern never leaks into
business logic.

```
                         Frontend (React + Redux)
                                │  HTTP
                                ▼
  ┌──────────────────────────────────────────────────┐
  │  Backend (NestJS)                                 │
  │                                                  │
  │  Controllers ──► Services ──► Adapters           │
  │  (HTTP layer)    (domain)    (WompiService,      │
  │                                  DatabaseService) │
  │                                                  │
  │  In-memory product catalog & transaction store   │
  │  PostgreSQL available via DatabaseService         │
  └──────────────────────────────────────────────────┘
```

**Key design decisions:**

- **Stock reservation lifecycle** — When a transaction is created, stock is *reserved*
  (deducted but not sold). On payment success the reservation is *completed* (stock
  stays deducted). On payment failure or rejection, reserved stock is *released*
  (restored to available inventory). This prevents phantom stock depletion during
  abandoned checkouts.
- **In-memory transaction store** — Transactions are kept in a `Map` on the
  `TransactionService` instance for this challenge. The `DatabaseService` module is wired
  and ready for persistence but the current scope uses the in-process store for speed of
  iteration.
- **Deterministic sandbox fallback** — When `WOMPI_API_KEY` is empty or `WOMPI_ENV` is
  unset, the gateway adapter returns predictable mock responses so the full checkout
  flow works offline without any external calls.
- **Card validation** — Payment approval in sandbox mode is determined by the card number
  prefix: Visa (`4xxxxxxxxxxxxxxxxx`) and Mastercard (`5xxxxxxxxxxxxxxxxx`) are approved;
  all other numbers are rejected.

## Stack

| Layer     | Technologies                                                    |
| --------- | --------------------------------------------------------------- |
| Frontend  | React 19 · Vite 8 · TypeScript 6 · Redux Toolkit 2 · React Testing Library · Vitest |
| Backend   | NestJS 12 · TypeScript 6 · Node.js · PostgreSQL (`pg`) · Vitest · Oxlint · Prettier |
| Payment   | Wompi sandbox API (Bearer token auth via `@nestjs/axios`)       |
| Dev ops   | Docker Compose (PostgreSQL 16 + backend + frontend)            |

---

## Features

- **Product catalog** — Three seeded products (Aurora Headphones, Pulse Smartwatch, Echo
  Mini Speaker) with stock availability displayed per item.
- **Multi-step checkout** — Five-step flow: Cart → Customer → Delivery → Payment →
  Confirmation. Each step is unlocked only when the previous step is valid.
- **Directional step transitions** — Forward and backward navigation animates with
  context-sensitive slide directions. Respects `prefers-reduced-motion`.
- **Redux + localStorage persistence** — Cart items and the checkout form are persisted
  to `localStorage` and hydrated on startup so progress survives page refresh.
- **Stock reservation** — Stock is reserved at transaction creation, released on
  rejection, and committed on approval.
- **Transaction lifecycle** — A transaction starts as `pending`, transitions to `approved`
  or `failed` after payment, and carries a provider reference and status.
- **Fees** — Base fee of COP $12,000 and delivery fee of COP $9,000 are added to every
  order total.
- **Currency formatting** — Colombian pesos (COP) formatted with `Intl.NumberFormat`
  (`es-CO` locale).
- **Health endpoint** — `GET /health` returns service liveness and a timestamp.
- **Accessibility** — Screen-reader-only step headings, focus management on navigation,
  semantic HTML, and `aria-label`s on interactive groups.
- **Docker Compose** — One-command stack with PostgreSQL, backend, and frontend services.

---

## Project structure

```
Wompi Checkout Challenge
├── docker-compose.yml              # Dev: postgres + backend + frontend
├── docker/
│   └── init.sql                    # PostgreSQL schema seed
├── apps/
│   ├── backend/                    # NestJS API
│   │   ├── src/
│   │   │   ├── app.module.ts       # Root module (Config, Database, Wompi)
│   │   │   ├── app.controller.ts   # Root + health endpoint
│   │   │   ├── app.service.ts      # Health service
│   │   │   ├── products/
│   │   │   │   ├── products.controller.ts
│   │   │   │   └── products.service.ts  # In-memory product catalog + stock ops
│   │   │   ├── transactions/
│   │   │   │   ├── transactions.controller.ts
│   │   │   │   ├── transaction.service.ts  # Domain: fees, lifecycle, card check
│   │   │   │   └── transaction.service.spec.ts
│   │   │   ├── wompi/
│   │   │   │   ├── wompi.module.ts
│   │   │   │   └── wompi.service.ts      # Adapter: sandbox HTTP calls
│   │   │   └── database/
│   │   │       ├── database.module.ts
│   │   │       └── database.service.ts   # PostgreSQL pool (optional)
│   │   └── .env.example
│   └── frontend/                   # React SPA
│       ├── src/
│       │   ├── App.tsx             # Main checkout component (5-step flow)
│       │   ├── main.tsx            # React entry + Redux Provider
│       │   ├── App.css             # Step transitions, grid layout, dark accents
│       │   ├── index.css           # Base styles, font smoothing
│       │   └── store/
│       │       ├── cartSlice.ts    # Cart state + localStorage persistence
│       │       ├── checkoutSlice.ts # Form state, validation, step logic
│       │       ├── store.ts        # Redux store configuration
│       │       └── checkoutSlice.test.ts
│       └── App.test.tsx            # E2E-style checkout flow tests
└── package.json                    # Root scripts (backend, frontend, start:dev, test)
```

---

## Local setup

### Option A — Docker Compose (recommended)

```bash
# Start PostgreSQL, backend, and frontend
docker compose up -d

# Backend API:  http://localhost:3000
# Frontend app: http://localhost:4173
```

The Compose stack includes a PostgreSQL 16 container with a health check and the
`init.sql` schema. The backend starts once postgres is healthy. See
[Docker setup](#deployment-notes) for more details.

### Option B — Run services manually

**Prerequisites:** Node.js 20+, PostgreSQL (optional — products run in-memory).

#### Backend

```bash
cd apps/backend
cp .env.example .env
npm install
npm run start:dev
# → http://localhost:3000
```

#### Frontend

```bash
cd apps/frontend
npm install
npm run dev
# → http://localhost:5173 (or 4173 if using the root script)
```

#### Run both at once (from repo root)

```bash
npm run start:dev
```

### Environment variables

Create `apps/backend/.env` from the example:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/checkout_db
DB_SSL=false
WOMPI_ENV=sandbox
WOMPI_API_KEY=prv_stagtest_your_key_here
WOMPI_BASE_URL=https://api-sandbox.co.uat.wompi.dev/v1
```

| Variable           | Description                                              |
| ------------------ | -------------------------------------------------------- |
| `PORT`             | Backend HTTP port (default: 3000)                        |
| `DATABASE_URL`     | PostgreSQL connection string (used by `DatabaseService`) |
| `DB_SSL`           | Set to `"true"` to enable SSL for the database pool      |
| `WOMPI_ENV`        | `sandbox` (default) — controls whether real API calls fire |
| `WOMPI_API_KEY`    | Wompi sandbox bearer token. Leave empty for deterministic mock mode |
| `WOMPI_BASE_URL`   | Wompi API base URL (`https://sandbox.wompi.co/v1`)       |

When `WOMPI_API_KEY` is empty or `WOMPI_ENV` is not `sandbox`, the payment adapter
returns deterministic mock responses — the checkout flow works end-to-end without any
external configuration.

---

## API endpoints

All product and transaction routes are prefixed with `/api`.

| Method | Endpoint                      | Description                                         |
| ------ | ----------------------------- | --------------------------------------------------- |
| GET    | `/health`                     | Service liveness check with timestamp               |
| GET    | `/api/products`               | List all products with stock                        |
| GET    | `/api/products/:id`           | Get a single product by ID                          |
| POST   | `/api/transactions`           | Create a pending transaction (reserves stock)       |
| GET    | `/api/transactions/:id`       | Get transaction details by ID                       |
| POST   | `/api/transactions/:id/pay`   | Execute payment against Wompi (approves or rejects) |

### Transaction creation

`POST /api/transactions` accepts a payload with one or more line items:

```json
{
  "productId": "prod-aurora",
  "quantity": 1,
  "customer": {
    "name": "Ana García",
    "email": "ana@example.com",
    "documentType": "CC",
    "documentNumber": "1020304050"
  },
  "delivery": {
    "address": "Carrera 15 # 92-30",
    "city": "Bogotá",
    "state": "Bogotá D.C.",
    "postalCode": "110111",
    "phone": "+57 300 123 4567"
  },
  "payment": {
    "cardNumber": "4111111111111111",
    "holderName": "ANA GARCIA",
    "expMonth": "12",
    "expYear": "2028",
    "cvv": "123"
  }
}
```

The response includes the transaction ID, reference, fees, total, and `pending` status.
Stock is reserved immediately.

### Payment execution

`POST /api/transactions/:id/pay` triggers the Wompi adapter. The response shape is:

```json
{
  "success": true,
  "message": "Payment completed successfully",
  "transaction": { "id": "txn-...", "status": "approved", "reference": "TXN-...", /* ... */ }
}
```

On failure, `success` is `false` and the transaction status is set to `failed`.
Reserved stock is released automatically.

### Fee calculation

| Fee          | Amount (COP) |
| ------------ | ------------ |
| Base fee     | $12,000      |
| Delivery fee | $9,000       |

```
total = Σ(productPrice × quantity) + baseFee + deliveryFee
```

### API Documentation (Swagger + Postman)

Interactive API documentation is available at:

- **Swagger UI**: `http://localhost:3000/api/docs` (when backend is running)
- **OpenAPI JSON**: `http://localhost:3000/api/docs-json`
- **Postman collection**: [`docs/postman_collection.json`](docs/postman_collection.json)

The OpenAPI spec is generated from `@nestjs/swagger` decorators on all controllers and
DTOs. To regenerate:

```bash
cd apps/backend
npm run docs:postman   # generates openapi.json → docs/postman_collection.json
```

---

## Checkout flow

The frontend presents a five-step horizontal checkout with a live stepper and a persistent
summary panel on the right:

1. **Cart** — Browse products, select quantities. At least one item is required to proceed.
2. **Customer** — Name, email, document type, and number.
3. **Delivery** — Address, city, state, postal code, and phone.
4. **Payment** — Card number, holder name, expiration, and CVV.
5. **Confirmation** — Payment result card and full order summary.

Each step validates before unlocking the next. Users can navigate backward freely. On
successful payment the cart clears and the confirmation panel shows the final summary.
A "Nueva compra" (New Purchase) button resets the flow.

## Data Model

This section is the **single source of truth** for the domain entities. The same content
was previously in `TECHNICAL_SPEC.md` §5 and is now consolidated here.

### Entity-Relationship Diagram

```mermaid
erDiagram
    Product ||--o{ InventoryMovement : "has"
    Product ||--o{ Transaction : "sold in"
    Customer ||--o{ Transaction : "places"
    Customer ||--o{ Delivery : "receives at"
    Transaction ||--|| Delivery : "has one"
    Transaction ||--o{ InventoryMovement : "generates"
    
    Product {
        string id PK
        string name
        string description
        integer price
        integer stock
        string currency
        string imageUrl
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }
    
    Customer {
        string id PK
        string name
        string email
        string documentType
        string documentNumber
        string phone
        datetime createdAt
    }
    
    Delivery {
        string id PK
        string customerId FK
        string address
        string city
        string state
        string postalCode
        string phone
        datetime createdAt
    }
    
    Transaction {
        string id PK
        string customerId FK
        string productId FK
        integer quantity
        integer amount
        integer baseFee
        integer deliveryFee
        integer total
        string status
        string paymentProvider
        string providerReference
        string providerStatus
        string errorMessage
        datetime createdAt
        datetime updatedAt
    }
    
    InventoryMovement {
        string id PK
        string productId FK
        integer delta
        string reason
        string transactionId FK
        datetime createdAt
    }
```

### Entity Field Tables

#### Product

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Primary key (e.g., `prod-aurora`) |
| `name` | `string` | Product display name |
| `description` | `string` | Product description |
| `price` | `integer` | Unit price in minor currency units (COP cents) |
| `stock` | `integer` | Available stock quantity |
| `currency` | `string` | ISO 4217 currency code (always `COP`) |
| `imageUrl` | `string` | Product image URL |
| `isActive` | `boolean` | Whether the product is purchasable |
| `createdAt` | `datetime` | ISO 8601 creation timestamp |
| `updatedAt` | `datetime` | ISO 8601 last update timestamp |

#### Customer

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Primary key |
| `name` | `string` | Full name |
| `email` | `string` | Email address |
| `documentType` | `string` | Document type (`CC`, `CE`, `NIT`, `PP`) |
| `documentNumber` | `string` | Document identifier |
| `phone` | `string` | Contact phone |
| `createdAt` | `datetime` | ISO 8601 creation timestamp |

#### Delivery

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Primary key |
| `customerId` | `string` | Foreign key → `Customer.id` |
| `address` | `string` | Street address |
| `city` | `string` | City |
| `state` | `string` | State/department |
| `postalCode` | `string` | Postal code |
| `phone` | `string` | Delivery contact phone |
| `createdAt` | `datetime` | ISO 8601 creation timestamp |

#### Transaction

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Primary key (e.g., `txn-1234567890`) |
| `customerId` | `string` | Foreign key → `Customer.id` |
| `productId` | `string` | Foreign key → `Product.id` (primary item) |
| `quantity` | `integer` | Total quantity across all items |
| `amount` | `integer` | Subtotal (sum of `price × quantity`) in COP cents |
| `baseFee` | `integer` | Fixed base fee (COP 12,000) |
| `deliveryFee` | `integer` | Fixed delivery fee (COP 9,000) |
| `total` | `integer` | `amount + baseFee + deliveryFee` |
| `status` | `string` | Current state (see [Transaction States](#transaction-states)) |
| `paymentProvider` | `string` | Provider identifier (always `wompi`) |
| `providerReference` | `string` | Provider transaction reference |
| `providerStatus` | `string` | Raw provider status |
| `errorMessage` | `string` | Error detail when status is `failed`/`rejected` |
| `createdAt` | `datetime` | ISO 8601 creation timestamp |
| `updatedAt` | `datetime` | ISO 8601 last update timestamp |

> **Note:** The `Transaction` entity also contains an embedded `items` array of `TransactionItemRecord` with `productId`, `quantity`, and `amount` per line item, plus embedded `customer` and `delivery` objects.

#### InventoryMovement

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Primary key |
| `productId` | `string` | Foreign key → `Product.id` |
| `delta` | `integer` | Stock change (negative for reservation/sale, positive for release) |
| `reason` | `string` | Human-readable reason (`reserved`, `released`, `completed`, `adjusted`) |
| `transactionId` | `string` | Foreign key → `Transaction.id` |
| `createdAt` | `datetime` | ISO 8601 creation timestamp |

### Transaction States

| State | Description | Terminal? |
|-------|-------------|-----------|
| `pending` | Transaction created, stock reserved, awaiting payment | No |
| `processing` | Payment request sent to provider, awaiting response | No |
| `approved` | Payment succeeded, stock committed, delivery assigned | **Yes** |
| `rejected` | Payment declined by provider, stock released | **Yes** |
| `failed` | Provider error or timeout, stock released | **Yes** |
| `cancelled` | Explicitly cancelled before payment, stock released | **Yes** |

#### Permitted Transitions

```mermaid
stateDiagram-v2
    [*] --> pending: POST /api/transactions
    pending --> processing: POST /api/transactions/:id/pay
    processing --> approved: Wompi returns APPROVED
    processing --> rejected: Wompi returns DECLINED
    processing --> failed: Wompi returns ERROR / timeout / network error
    pending --> cancelled: Explicit cancel (future)
    processing --> cancelled: Explicit cancel during 3DS (future)
```

### Business Rules

1. **Stock sufficiency** — A transaction may only be created if the product stock is sufficient for the requested quantity.
2. **Payment once** — Payment must be processed only once per transaction. Duplicate payment attempts are rejected.
3. **Stock release on failure** — If the payment fails, is rejected, or times out, the transaction is marked `failed`/`rejected` and reserved stock is released (restored to available inventory).
4. **Stock commit on success** — If the payment succeeds, stock reservation is completed (stock stays deducted) and the delivery is assigned to the customer.
5. **No raw card storage** — The system must not store actual raw card secrets (PAN, CVV) in plain text. Only tokenized or masked values may be persisted.
6. **Idempotency** — Payment requests include an `X-Idempotency-Key` (the transaction reference) to prevent duplicate charges on retry.
7. **Fees are fixed** — Every transaction includes a base fee of COP 12,000 and a delivery fee of COP 9,000, added to the product subtotal.

---

## Payment adapter

`WompiService` is the sole adapter that talks to the Wompi sandbox API. It exposes two
methods:

- `registerPaymentAttempt()` — Called at transaction creation to register an intent.
- `authorizePayment()` — Called at payment time to charge the card.

Both methods check for a valid `WOMPI_API_KEY` and `WOMPI_ENV=sandbox`. If those are
missing, the adapter returns deterministic mock results, enabling the full flow without
any external dependency or secret.

When the real API path is active, requests are sent via `@nestjs/axios` (RxJS `firstValueFrom`)
to `https://sandbox.wompi.co/v1/transactions` with a Bearer token header. Errors are
caught and logged; the transaction is marked `failed` with a safe user-facing message.

---

## Testing

### Backend (Vitest)

```bash
cd apps/backend
npm run test        # run all unit tests
npm run test:cov    # run with coverage
npm run test:watch  # watch mode
npm run test:e2e    # e2e tests (separate vitest config)
```

Test files:

- `src/app.controller.spec.ts` — Health endpoint test
- `src/transactions/transaction.service.spec.ts` — Fee calculation, stock reservation,
  multi-item transactions, payment approval/rejection, stock release on failure

### Frontend (Vitest + React Testing Library)

```bash
cd apps/frontend
npx vitest run
```

Test files:

- `src/App.test.tsx` — End-to-end checkout flow: product → customer → delivery → payment →
  confirmation summary verification
- `src/store/checkoutSlice.test.ts` — State management: step validation, step unlocking,
  confirmation vs. purchase summary separation

### Coverage

Both backend and frontend enforce an 80% minimum coverage threshold. Latest results:

**Backend (Vitest + @vitest/coverage-v8):**

| Metric     | Current  | Threshold |
|------------|:--------:|:---------:|
| Statements  | 93.12%   | ≥ 80%     |
| Branches    | 88.23%   | ≥ 80%     |
| Functions   | 86.02%   | ≥ 80%     |
| Lines       | 93.38%   | ≥ 80%     |

**Frontend (Vitest + @vitest/coverage-v8):**

| Metric     | Current  | Threshold |
|------------|:--------:|:---------:|
| Statements  | 94.21%   | ≥ 80%     |
| Branches    | 85.43%   | ≥ 80%     |
| Functions   | 93.93%   | ≥ 80%     |
| Lines       | 93.88%   | ≥ 80%     |

- Pending transaction creation with fee calculation
- Stock reservation (deduct on create)
- Multi-product checkout
- Stock release on payment rejection
- Stock completion on payment success

---

## Styling and responsive design

The frontend uses **vanilla CSS** (no Tailwind) with CSS Grid and Flexbox. Key properties:

- **Mobile-first** — Layout switches from two-column to single-column below 900px; form
  fields switch from two-column to single-column below 560px.
- **Step transitions** — CSS `cubic-bezier(0.16, 1, 0.3, 1)` animations with staggered
  child entry. Forward/backward direction tracked for slide direction. `prefers-reduced-motion`
  disables all animations.
- **Touch targets** — Buttons sized for mobile interaction with `:active` scale feedback.
- **Focus management** — The step heading receives programmatic focus (with `preventScroll`)
  so keyboard and screen-reader users are announced on navigation.

---

## Deployment notes

### Docker Compose

```yaml
# docker-compose.yml
services:
  postgres   # PostgreSQL 16, port 5432, seeded via docker/init.sql
  backend    # NestJS, port 3000, depends on postgres health
  frontend   # Vite preview, port 4173, depends on backend
```

```bash
docker compose up -d
```

### Production hardening (future work)

- Replace the in-memory transaction store with PostgreSQL persistence via
  `DatabaseService` and proper entity models.
- Add rate limiting on payment endpoints (e.g. `@nestjs/throttler`).
- Enforce HTTPS, security headers, and strict CORS in production.
- Move all Wompi credentials to a secrets manager; never expose them to the frontend.
- Add structured logging and monitoring (health checks, request IDs).
- Run the frontend behind a CDN (S3 + CloudFront or equivalent).
