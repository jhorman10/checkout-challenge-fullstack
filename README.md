# Wompi Checkout Challenge

This project delivers a functional checkout flow for a commerce challenge with a React frontend and a NestJS backend. The implementation is organized around a small checkout domain: product catalog, cart state, customer and delivery data, and a payment gateway adapter.

## Stack

- Frontend: React + Vite + TypeScript + Redux Toolkit
- Backend: NestJS + TypeScript
- Payment gateway: Wompi sandbox adapter via HTTP service
- Testing: Jest with coverage threshold on the backend service layer

## Features

- Product catalog with stock validation
- Multi-step checkout flow (cart, customer, shipping, payment, confirmation)
- Redux-managed cart and checkout state persisted in localStorage
- Transaction creation and payment validation with approval/rejection states
- Provider adapter abstraction to keep Wompi integration isolated from business logic
- Secure configuration through environment variables

## Local setup

### Backend

```bash
cd apps/backend
cp .env.example .env
npm install
npm run start:dev
```

### Frontend

```bash
cd apps/frontend
npm install
npm run dev -- --host 0.0.0.0
```

### Environment variables

Create a backend `.env` file with the following values:

```env
PORT=3000
WOMPI_ENV=sandbox
WOMPI_API_KEY=your_wompi_api_key
WOMPI_BASE_URL=https://sandbox.wompi.co/v1
```

If the gateway key is not configured, the API falls back to a deterministic sandbox flow so the checkout still works for local development and validation.

## API endpoints

- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/transactions`
- `GET /api/transactions/:id`
- `POST /api/transactions/:id/pay`

## Validation

Run the backend suite with:

```bash
cd apps/backend
npm test
```

This project is structured to be easy to extend toward a public deployment and a real production Wompi account at the provider level.
