# Tasks — Product Checkout and Payment Onboarding

## Task breakdown

### Phase 1 — Foundation
- [ ] Initialize project structure for frontend and backend
- [ ] Configure environment variables and sandbox configuration
- [ ] Set up database and seed products
- [ ] Add health check endpoint and base app structure

### Phase 2 — Product and UI flow
- [ ] Build product page and stock display
- [ ] Implement quantity selector and validation
- [ ] Build payment modal and delivery form
- [ ] Persist checkout state in localStorage and restore after refresh

### Phase 3 — Backend domain logic
- [ ] Create product and customer domain models
- [ ] Implement validation for card, delivery, and transaction inputs
- [ ] Build transaction creation use case and repository
- [ ] Enforce stock checks before payment

### Phase 4 — Payment integration
- [ ] Implement Wompi sandbox adapter
- [ ] Create transaction payment service
- [ ] Map provider result to internal transaction states
- [ ] Handle failed or rejected payments without inventory drift

### Phase 5 — Inventory and delivery
- [ ] Assign delivery records after successful payment
- [ ] Deduct stock from product inventory
- [ ] Record inventory movement history

### Phase 6 — Verification and polish
- [ ] Add frontend tests for product and flow validation
- [ ] Add backend tests for use cases and API endpoints
- [ ] Confirm >80% coverage across the project
- [ ] Document API via Swagger or Postman collection
- [ ] Update README with setup, variables, and deployment notes

### Phase 7 — Deployment
- [ ] Configure cloud deployment for frontend and backend
- [ ] Verify HTTPS and security headers
- [ ] Validate app in sandbox and confirm end-to-end flow

## Definition of done

The feature is complete when:
- the five-step flow works end-to-end,
- stock updates correctly,
- transaction states are persisted and auditable,
- tests pass and coverage is above 80%,
- deployment works in sandbox-ready configuration.
