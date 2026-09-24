# Spec — Product Checkout and Payment Onboarding

## Functional requirements

### FR-01 Product page
The system must show a product with name, description, price, image, and current stock quantity.

### FR-02 Product quantity validation
The buyer must not be allowed to purchase more units than currently available in stock.

### FR-03 Credit card modal
The system must open a payment modal to collect credit card data and validate format, card brand, and expiry.

### FR-04 Delivery validation
The system must require delivery information such as city, address, postal code, and phone number.

### FR-05 Summary screen
The app must show the product amount, base fee, delivery fee, and total before confirming payment.

### FR-06 Transaction creation
When the user confirms payment, the backend must create a transaction in pending state and return a transaction reference.

### FR-07 Wompi sandbox integration
The backend must call the Wompi sandbox API to validate and process the payment.

### FR-08 Transaction result persistence
The backend must persist the final provider response and the transaction state.

### FR-09 Delivery assignment
If the payment succeeds, the system must assign the product for delivery to the customer.

### FR-10 Inventory update
If the payment succeeds, the backend must decrement stock for the selected product.

### FR-11 Recovery after refresh
The frontend must restore the payment state from persisted local data after refresh.

### FR-12 Final status screen
The app must display a final success or failure message and redirect to the product page after completion.

## Non-functional requirements

### NFR-01 Security
Sensitive payment data must not be stored in plaintext.

### NFR-02 Performance
UI response should remain fluid on mobile devices, with no layout overflow.

### NFR-03 Testability
Backend and frontend must have automated unit and integration tests with >80% coverage.

### NFR-04 Observability
The API must expose health status and traceable transaction states.

### NFR-05 Deployment readiness
The solution must be deployable to a cloud provider with environment configuration.

## Acceptance scenarios

### Scenario 1 — Happy path
Given a product with stock available,
When the customer enters valid card and delivery data,
Then a pending transaction is created,
And the payment is processed in sandbox,
And the transaction is marked approved,
And the stock is reduced,
And the final status is displayed.

### Scenario 2 — Insufficient stock
Given the product stock is lower than the requested quantity,
When the user attempts to pay,
Then the system must reject the transaction before processing.

### Scenario 3 — Invalid card data
Given the card data is malformed,
When the user submits the form,
Then the validation fails and the payment is not sent to Wompi.

### Scenario 4 — Payment failure
Given the provider returns a rejected payment,
Then the transaction is stored with rejected or failed status,
And inventory is not reduced.

### Scenario 5 — Refresh recovery
Given the buyer refreshed the page during checkout,
When the app reloads,
Then the checkout state is restored from local storage and the buyer can continue.
