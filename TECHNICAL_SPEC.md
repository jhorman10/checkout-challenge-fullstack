# Technical Specification — Payment Onboarding Test

## 1. Objective

Build a mobile-first checkout flow for a paid product that allows a customer to:

1. View a product and stock availability.
2. Enter payment and delivery information.
3. Review the order summary.
4. Complete the payment through a sandbox Wompi integration.
5. Receive a final transaction result and return to the product view with updated stock.

The solution must include a React SPA frontend and a TypeScript backend API with persistence, validation, business logic separated from controllers, and automated tests with coverage above 80%.

---

## 2. Product and business flow

### Core user journey

1. Product page
   - Show product details: name, description, image, unit price, and available stock.
   - Display quantity selector and buying CTA.
   - If stock is zero, disable purchase flow.

2. Payment and delivery form
   - Open a modal with payment type selection.
   - Require credit card data with validation.
   - Require delivery information with validation.
   - Persist the partial progress locally so refresh recovery is possible.

3. Summary screen
   - Show product subtotal, base fee, delivery fee, and total.
   - Allow final payment confirmation.
   - Provide a backdrop modal/overlay with a clear action button.

4. Final status screen
   - Display transaction status: success or failure.
   - Show transaction reference and domain-safe messages.
   - Return to the product page after completion.

5. Product page after payment
   - Product stock is updated based on the real sale.
   - The customer sees the updated stock quantity.

---

## 3. Functional requirements

### 3.1 Frontend requirements

- SPA built with React + Vite or CRA only.
- Use React state management with Redux or Zustand (Redux preferred if the project is richer), following Flux-like architecture.
- Mobile-first design focused on a small-screen target such as iPhone SE.
- Use responsive layout rules with CSS Grid/Flexbox.
- Product and checkout flow must work across multiple screen sizes.
- Partial order data must be stored securely in application state and localStorage.
- Recover checkout progress after page refresh.
- Credit card validation should detect card type (Visa/Mastercard) and accept fake but structurally valid numbers.
- Use accessible and clear UI states for loading, error, and success.

### 3.2 Backend requirements

- Backend built with TypeScript and NestJS.
- Business logic must not live in the controller layer.
- Use a layered architecture with application/use cases and infrastructure adapters.
- Prefer hexagonal architecture and ports/adapters pattern.
- Use Railway-Oriented Programming patterns for domain operations and error handling.
- Use PostgreSQL for the main persistence layer.
- Seed dummy products with realistic data.
- No endpoint to create new products is required.

### 3.3 Transaction flow requirements

When the user confirms payment:

1. Create a transaction in PENDING state in the backend.
2. Generate a transaction reference/number.
3. Call the Wompi sandbox API to create or confirm the payment.
4. Update the transaction result in the backend.
5. Register the delivery assignment.
6. Update stock based on the transaction result.
7. Return to the frontend with a final outcome.

---

## 4. API design

### 4.1 API goals

The API must provide a clean domain model and meaningful validation. It should handle checkout, customer, delivery, inventory, and transaction state without mixing concerns.

### 4.2 Endpoints

#### Public endpoints

- GET /api/products
  - Returns available products and stock.
  - Response includes product id, name, description, price, stock, imageUrl.

- GET /api/products/:id
  - Returns one product with current stock and price.

- POST /api/transactions
  - Creates a PENDING transaction.
  - Stores customer and delivery payload in a secure, validated way.
  - Returns transaction id and status.

- POST /api/transactions/:id/pay
  - Starts the payment flow against Wompi sandbox.
  - Validates the transaction state before processing.

- GET /api/transactions/:id
  - Returns transaction details and final status.

- GET /api/health
  - Liveness check for deployment and monitoring.

#### Internal service integration endpoints

- Wompi integration is not directly exposed to the frontend.
- The backend acts as the trusted adapter between the web app and the Wompi sandbox API.

### 4.3 Request and response contracts

#### Product response

```json
{
  "id": "prod_123",
  "name": "Wireless Headphones",
  "description": "Bluetooth over-ear headphones",
  "price": 129900,
  "stock": 12,
  "currency": "COP",
  "imageUrl": "https://example.com/image.jpg"
}
```

#### Transaction create request

```json
{
  "productId": "prod_123",
  "quantity": 1,
  "customer": {
    "name": "Ana Gomez",
    "email": "ana@example.com",
    "documentType": "CC",
    "documentNumber": "1234567890"
  },
  "delivery": {
    "address": "Cra 7 # 15-30",
    "city": "Bogota",
    "state": "Cundinamarca",
    "postalCode": "110111",
    "phone": "+573001112233"
  },
  "payment": {
    "cardNumber": "4111111111111111",
    "holderName": "ANA GOMEZ",
    "expMonth": "12",
    "expYear": "2028",
    "cvv": "123"
  }
}
```

#### Transaction response

```json
{
  "id": "txn_001",
  "status": "pending",
  "reference": "WPI-20260924-001",
  "amount": 160000,
  "currency": "COP",
  "createdAt": "2026-09-24T10:00:00Z"
}
```

---

## 5. Data model

> **⚠️ DEPRECATED:** The authoritative data model is now in [`README.md#data-model`](../README.md#data-model).
> This section is retained for historical reference only and may diverge.

### 5.1 Entities

#### Product
- id
- name
- description
- price
- stock
- currency
- imageUrl
- isActive
- createdAt
- updatedAt

#### Customer
- id
- name
- email
- documentType
- documentNumber
- phone
- createdAt

#### Delivery
- id
- customerId
- address
- city
- state
- postalCode
- phone
- createdAt

#### Transaction
- id
- customerId
- productId
- quantity
- amount
- baseFee
- deliveryFee
- total
- status
- paymentProvider
- providerReference
- providerStatus
- errorMessage
- createdAt
- updatedAt

#### InventoryMovement
- id
- productId
- delta
- reason
- transactionId
- createdAt

### 5.2 Transaction states

- pending
- processing
- approved
- rejected
- failed
- cancelled

### 5.3 Business rules

- A transaction may only be paid if the product stock is sufficient for the requested quantity.
- Payment must be processed only once per transaction.
- If the payment fails, the transaction is marked as failed and stock is not reserved.
- If the payment succeeds, stock is decremented and the delivery is assigned to the customer.
- The system must not store actual raw card secrets in plain text.

---

## 6. Validation and security requirements

### 6.1 Input validation

- Validate required fields before creating a transaction.
- Validate email and phone formatting.
- Validate delivery address and postal code shape.
- Validate credit card format structurally (Luhn check is recommended).
- Reject invalid or expired cards.
- Validate product quantity against stock.

### 6.2 Sensitive data handling

- Do not store raw card information in plaintext.
- Encrypt sensitive fields before persistence or use tokenized values.
- Use environment variables for provider credentials and sandbox keys.
- Do not commit secrets to the repository.
- Use HTTPS in all client-server communication.
- Add security headers in production deployments.

### 6.3 OWASP alignment

- Validate all user input.
- Prevent mass assignment vulnerabilities.
- Use least privilege for database and provider credentials.
- Avoid exposing internal errors to the client.
- Add rate limiting or basic abuse prevention for payment endpoints.

---

## 7. Frontend state and resilience requirements

### 7.1 Required state persistence

The frontend must keep enough state to recover the checkout flow after refresh:

- selected product
- quantity
- customer payload
- delivery payload
- credit card data (masked or minimally stored)
- transaction id status
- current stage in the flow

### 7.2 Recommended strategy

- Use Redux store for app state.
- Persist a reduced checkout snapshot to localStorage.
- On app startup, hydrate the store from localStorage and continue the flow.
- Update the persisted state after every change.
- Handle stale data and expired sessions gracefully.

---

## 8. Wompi sandbox integration design

### 8.1 Integration contract

The backend acts as an adapter to Wompi sandbox APIs.

- Use sandbox environment variables.
- Use provider keys only in server-side configuration.
- Keep all provider calls inside infrastructure or adapter modules.
- Map Wompi provider responses to internal transaction states.

### 8.2 Payment flow

1. Backend creates transaction with status = pending.
2. Backend sends payment request to Wompi sandbox.
3. API responds with approval or rejection.
4. Backend updates transaction and stock according to the result.
5. Frontend redirects to the result view with a transaction reference.

### 8.3 Failure handling

- Retry only for transient provider failures.
- If provider call fails, mark transaction as failed and return a safe message.
- If the transaction was already processed, prevent duplicate charges.

---

## 9. UX requirements

### 9.1 Screen behavior

- Product page shows product, price, stock, and quantity selector.
- Payment modal opens from a CTA like “Pay with credit card”.
- Credit card input should show the detected card brand when possible.
- Summary screen must clearly show:
  - product amount,
  - base fee,
  - delivery fee,
  - total.
- Final status screen should show a success or failure message with a clear CTA.
- After completion, redirect to the product page and show updated stock.

### 9.2 Mobile-first UI rules

- Fit all elements within mobile boundaries.
- No horizontal overflow.
- Buttons must be accessible and large enough for touch input.
- Keep the flow linear and legible for a 5-step experience.

---

## 10. Testing strategy

### 10.1 Backend tests

Use Jest with NestJS testing tools.

Minimum coverage target: 80%+ on statements, branches, functions, and lines.

Required test types:
- unit tests for validation and business logic
- integration tests for REST endpoints
- tests for Wompi adapter behavior and failure paths
- tests for stock update rules
- tests for transaction lifecycle transitions

### 10.2 Frontend tests

Use React Testing Library and Jest.

Required test types:
- product rendering and stock states
- form validation for card and delivery inputs
- form recovery after refresh
- summary calculation logic
- final success/failure handling

### 10.3 Coverage report

The README must include a coverage summary and command used to generate it.

---

## 11. Deployment and infrastructure

### 11.1 Recommended deployment model

- Frontend: AWS S3 + CloudFront
- Backend: AWS Lambda + API Gateway or ECS/Fargate
- Database: PostgreSQL on RDS or a managed equivalent
- Optional: environment variables managed via AWS Secrets Manager or equivalent

### 11.2 Production notes

- Use HTTPS endpoints only.
- Apply correct CORS policies.
- Keep environment-specific configuration explicit.
- Verify all API routes are secured and not allowing direct access to provider credentials.

---

## 12. Deliverables

The final project must provide:

1. Full frontend SPA with the 5-step checkout flow.
2. Backend API with validation, domain logic, persistence, and Wompi adapter.
3. Database schema and seeded products.
4. Swagger or Postman collection in the README.
5. README with setup, architecture, environment variables, and test coverage results.
6. Public GitHub repository.
7. Deployed app and backend in cloud infrastructure.

---

## 13. Acceptance criteria

The solution is accepted when all of the following are true:

- Product page shows product and stock.
- Payment modal opens correctly.
- Credit card and delivery are validated.
- Summary includes all required amounts.
- Payment creates a backend transaction in pending state.
- Sandbox Wompi payment call is executed from backend.
- Transaction result is persisted.
- Stock is updated after successful payment.
- Final status screen displays the outcome clearly.
- Refresh recovery works.
- Tests are present and coverage exceeds 80%.
- App is deployed and accessible.

---

## 14. Suggested implementation order

1. Set up project structure: frontend + backend + database.
2. Create product seed data and product API.
3. Implement form validation and UI flow.
4. Add Redux/localStorage persistence.
5. Implement backend transaction domain logic.
6. Add Wompi adapter and payment callback integration.
7. Add stock updates and delivery assignment logic.
8. Add tests for all critical flows.
9. Document API, architecture, and deployment in README.
10. Validate in sandbox and deploy.

---

## 15. Recommended technical stack

- Frontend: React + Redux + TypeScript + CSS Modules / Tailwind
- Backend: NestJS + TypeScript + PostgreSQL + Prisma (recommended) or TypeORM
- Testing: Jest + React Testing Library + NestJS testing utilities
- Deployment: AWS S3/CloudFront for frontend, AWS Lambda/API Gateway or ECS for backend

This specification is intentionally implementation-ready and aligned with the evaluation rubric in the test brief.
