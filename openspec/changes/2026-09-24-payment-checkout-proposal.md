# Proposal — Product Checkout and Payment Onboarding

## Summary

This change introduces a mobile-first payment onboarding flow for a single product purchase. The system must allow a user to review stock, provide payment and delivery information, confirm the purchase, process the payment with the Wompi sandbox API, and return to the product page with updated inventory.

## Motivation

The business needs a real-world checkout experience with secure handling of card and delivery data, reliable transaction state tracking, and visible product inventory updates after payment.

## Scope

### In scope
- Product detail and stock display
- Credit card and delivery form
- Summary and confirmation step
- Transaction creation and payment processing
- Transaction result persistence
- Delivery assignment and stock update
- Refresh recovery in the frontend
- Automated tests and documentation

### Out of scope
- Product creation endpoints
- Multi-product cart flows
- Real production payment processing outside sandbox
- Full CMS or analytics platform

## Assumptions

- The app will operate in sandbox mode for all Wompi interactions.
- Frontend state and local storage are used to recover the buyer journey.
- The backend is the sole integration point with Wompi.
- A single product purchase flow is sufficient for this challenge.

## Goals

- Provide a simple, low-friction checkout flow.
- Ensure secure handling of sensitive card data.
- Keep the system resilient and traceable.
- Protect inventory from invalid or duplicate payments.
- Deliver a clean design and measurable test coverage.

## Risks

- Duplicate payment attempts for the same transaction.
- Stock inconsistencies if payment and inventory updates are not atomic.
- Data leakage from unmasked sensitive fields.
- Provider integration failures during sandbox payment calls.

## Success criteria

- User can complete the full payment flow from product to final status.
- Stock changes only after successful payment.
- All critical business rules are validated.
- Test coverage exceeds 80%.
- The project includes working documentation and a deployable setup.
