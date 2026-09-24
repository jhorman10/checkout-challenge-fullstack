# Design — Product Checkout and Payment Onboarding

## Architecture overview

### Frontend
- React SPA
- Redux or equivalent state store
- Mobile-first UI with responsive layout
- Checkout state persisted in localStorage and hydrated on app startup

### Backend
- NestJS with TypeScript
- Layered domain architecture: controller -> use case -> service -> repository -> adapter
- Hexagonal architecture boundaries for payment provider and persistence
- PostgreSQL database with Prisma or TypeORM

## Module breakdown

### Frontend modules
- ProductPage
- CheckoutForm
- PaymentModal
- OrderSummary
- FinalStatusView
- store/checkoutSlice
- utils/validation
- persistence/localStorage

### Backend modules
- products
- customers
- deliveries
- transactions
- stock
- payments/wompi
- shared/validation
- shared/security

## Flow design

### Transaction lifecycle
pending -> processing -> approved | rejected | failed

### Payment process
1. Frontend submits order data.
2. Backend validates request and product stock.
3. Backend creates transaction with status pending.
4. Backend calls Wompi sandbox adapter.
5. Adapter returns provider result.
6. Backend updates transaction and inventory.
7. Backend returns final transaction data to frontend.
8. Frontend shows final status and redirects.

## Data mapping

### Product
- id, name, description, price, stock, currency, imageUrl

### Transaction
- id, customerId, productId, quantity, amount, baseFee, deliveryFee, total, status, providerReference, providerStatus, errorMessage

### Delivery
- customerId, address, city, state, postalCode, phone

## Security design

- Use environment variables for provider credentials
- Encrypt sensitive card data or store masked references
- Enforce validation at API boundary
- Hide provider internals from client responses
- Add HTTPS and security headers in deployment layer

## Testing design

- Backend unit tests for validation and use cases
- Integration tests for transaction endpoints
- Frontend component tests for product form and summary states
- E2E smoke testing for happy-path checkout flow

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Duplicate payment | Idempotency keys, single-payment guard |
| Inventory drift | Stock update after provider confirmation | 
| Sensitive data leak | Tokenization / encryption / masking |
| Provider outage | Graceful error handling and transaction state recording |
