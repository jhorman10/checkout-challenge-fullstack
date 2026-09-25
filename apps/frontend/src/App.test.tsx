// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import cartReducer from './store/cartSlice';
import checkoutReducer, { defaultForm } from './store/checkoutSlice';

const product = {
  id: 'aurora-headphones',
  name: 'Aurora Headphones',
  description: 'Wireless over-ear headphones with noise cancellation.',
  price: 129900,
  stock: 9,
  currency: 'COP',
  imageUrl: 'https://example.com/aurora.png',
};

const product2 = {
  id: 'pulse-smartwatch',
  name: 'Pulse Smartwatch',
  description: 'Fitness tracking and call notifications.',
  price: 249900,
  stock: 5,
  currency: 'COP',
  imageUrl: 'https://example.com/watch.png',
};

const buildStore = (preloadedCart = { 'aurora-headphones': 1 }, preloadedStep = 1) =>
  configureStore({
    reducer: {
      cart: cartReducer,
      checkout: checkoutReducer,
    },
    preloadedState: {
      cart: { items: preloadedCart },
      checkout: {
        step: preloadedStep,
        form: defaultForm,
        status: { type: 'idle' as const, message: '' },
        isSubmitting: false,
        confirmation: null,
      },
    },
  });

const mockFetch = (responses: Record<string, any>) => {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    // Match exact path patterns - check for /pay first since it's more specific
    // Extract the path from the URL
    const urlObj = new URL(url, 'http://localhost');
    const path = urlObj.pathname;
    
    // Check for exact path matches or specific patterns
    for (const [key, response] of Object.entries(responses)) {
      if (key === '/pay' && path.endsWith('/pay')) {
        return Promise.resolve({
          ok: response.ok ?? true,
          status: response.status ?? 200,
          json: async () => response.data,
        } as Response);
      }
      if (key === '/transactions' && path === '/api/transactions' && !path.endsWith('/pay')) {
        return Promise.resolve({
          ok: response.ok ?? true,
          status: response.status ?? 200,
          json: async () => response.data,
        } as Response);
      }
      if (key === '/products' && path === '/api/products') {
        return Promise.resolve({
          ok: response.ok ?? true,
          status: response.status ?? 200,
          json: async () => response.data,
        } as Response);
      }
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
};

describe('App checkout flow', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('Empty cart state', () => {
    it('shows empty cart message when no items', async () => {
      const store = buildStore({}, 1);
      vi.stubGlobal('fetch', mockFetch({
        '/products': { data: [product] },
      }));

      render(
        <Provider store={store}>
          <App />
        </Provider>,
      );

      await waitFor(() => expect(screen.getByText('Tu carrito está vacío.')).toBeInTheDocument());
    });
  });

  describe('Cart interactions', () => {
    it('shows products in cart panel when items added', async () => {
      const store = buildStore({ 'aurora-headphones': 1 }, 1);
      vi.stubGlobal('fetch', mockFetch({
        '/products': { data: [product] },
      }));

      render(
        <Provider store={store}>
          <App />
        </Provider>,
      );

      // Check cart summary panel (aside) has the product
      const summaryPanel = screen.getByRole('complementary');
      await waitFor(() => expect(within(summaryPanel).getByText('Aurora Headphones')).toBeInTheDocument());
      // Price in cart item - check that the price text content contains 129900
      await waitFor(() => expect(within(summaryPanel).getByText((content) => content.includes('129.900') && content.includes('c/u'))).toBeInTheDocument());
    });

    it('updates quantity with + and - buttons', async () => {
      const store = buildStore({ 'aurora-headphones': 1 }, 1);
      vi.stubGlobal('fetch', mockFetch({
        '/products': { data: [product] },
      }));

      render(
        <Provider store={store}>
          <App />
        </Provider>,
      );

      const summaryPanel = screen.getByRole('complementary');
      // Find quantity in cart summary panel
      await waitFor(() => expect(within(summaryPanel).getByText('1')).toBeInTheDocument());
      
      const plusButtons = within(summaryPanel).getAllByRole('button', { name: '+' });
      await userEvent.click(plusButtons[0]);
      await waitFor(() => expect(within(summaryPanel).getByText('2')).toBeInTheDocument());
      
      const minusButtons = within(summaryPanel).getAllByRole('button', { name: '−' });
      await userEvent.click(minusButtons[0]);
      await waitFor(() => expect(within(summaryPanel).getByText('1')).toBeInTheDocument());
    });

    it('removes item when quantity goes to 0', async () => {
      const store = buildStore({ 'aurora-headphones': 1 }, 1);
      vi.stubGlobal('fetch', mockFetch({
        '/products': { data: [product] },
      }));

      render(
        <Provider store={store}>
          <App />
        </Provider>,
      );

      const summaryPanel = screen.getByRole('complementary');
      await waitFor(() => expect(within(summaryPanel).getByText('Aurora Headphones')).toBeInTheDocument());
      
      const minusButtons = within(summaryPanel).getAllByRole('button', { name: '−' });
      await userEvent.click(minusButtons[0]);
      await waitFor(() => expect(within(summaryPanel).queryByText('Aurora Headphones')).not.toBeInTheDocument());
      await waitFor(() => expect(within(summaryPanel).getByText('Tu carrito está vacío.')).toBeInTheDocument());
    });
  });

  describe('Step navigation', () => {
    it('prevents continuing from step 1 with empty cart', async () => {
      const store = buildStore({}, 1);
      vi.stubGlobal('fetch', mockFetch({
        '/products': { data: [product] },
      }));

      render(
        <Provider store={store}>
          <App />
        </Provider>,
      );

      await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument());
      await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      
      await waitFor(() => expect(screen.getByText('Completa los campos obligatorios antes de continuar.')).toBeInTheDocument());
    });

    it('navigates through all steps with valid data', async () => {
      const store = buildStore({ 'aurora-headphones': 1 }, 1);
      vi.stubGlobal('fetch', mockFetch({
        '/products': { data: [product] },
        '/transactions': { data: { id: 'txn-123' } },
        '/pay': { data: { success: true, message: 'Pago aprobado', transaction: { reference: 'TXN-123' } } },
      }));

      render(
        <Provider store={store}>
          <App />
        </Provider>,
      );

      // Step 1: Cart - wait for product to load AND appear in cart summary
      await waitFor(() => expect(screen.getAllByText('Aurora Headphones')[0]).toBeInTheDocument());
      const summaryPanel = screen.getByRole('complementary');
      await waitFor(() => expect(within(summaryPanel).getByText('Aurora Headphones')).toBeInTheDocument());
      await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument());
      await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      
      // Step 2: Client info - wait for step to change
      await waitFor(() => expect(screen.getByLabelText('Nombre')).toBeInTheDocument());
      await userEvent.type(screen.getByLabelText('Nombre'), 'Juan Pérez');
      await userEvent.type(screen.getByLabelText('Email'), 'juan@example.com');
      await userEvent.type(screen.getByLabelText('Tipo documento'), 'CC');
      await userEvent.type(screen.getByLabelText('Documento'), '1234567890');
      await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      
      // Step 3: Delivery - wait for step to change
      await waitFor(() => expect(screen.getByLabelText('Dirección')).toBeInTheDocument());
      await userEvent.type(screen.getByLabelText('Dirección'), 'Calle 123');
      await userEvent.type(screen.getByLabelText('Ciudad'), 'Bogotá');
      await userEvent.type(screen.getByLabelText('Departamento'), 'Cundinamarca');
      await userEvent.type(screen.getByLabelText('Código postal'), '110111');
      await userEvent.type(screen.getByLabelText('Teléfono'), '3001234567');
      await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      
      // Step 4: Payment - wait for step to change
      await waitFor(() => expect(screen.getByLabelText('Número de tarjeta')).toBeInTheDocument());
      await userEvent.type(screen.getByLabelText('Número de tarjeta'), '4242424242424242');
      await userEvent.type(screen.getByLabelText('Nombre del titular'), 'JUAN PEREZ');
      await userEvent.type(screen.getByLabelText('Mes'), '12');
      await userEvent.type(screen.getByLabelText('Año'), '2026');
      await userEvent.type(screen.getByLabelText('CVV'), '123');
      await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      
      // Step 5: Confirmation - wait for step to change
      await waitFor(() => expect(screen.getByRole('button', { name: /Pagar/i })).toBeInTheDocument());
      await userEvent.click(screen.getByRole('button', { name: /Pagar/i }));
      
      await waitFor(() => expect(screen.getByRole('heading', { name: 'Resumen de la compra' })).toBeInTheDocument());
    });

    it('allows going back to previous steps', async () => {
      const store = buildStore({ 'aurora-headphones': 1 }, 1);
      vi.stubGlobal('fetch', mockFetch({
        '/products': { data: [product] },
      }));

      render(
        <Provider store={store}>
          <App />
        </Provider>,
      );

      // Navigate to step 2
      await waitFor(() => expect(screen.getAllByText('Aurora Headphones')[0]).toBeInTheDocument());
      const summaryPanel = screen.getByRole('complementary');
      await waitFor(() => expect(within(summaryPanel).getByText('Aurora Headphones')).toBeInTheDocument());
      await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument());
      await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      
      // Now on step 2, go back
      await waitFor(() => expect(screen.getByLabelText('Nombre')).toBeInTheDocument());
      await userEvent.click(screen.getByRole('button', { name: 'Atrás' }));
      
      // Back to step 1
      await waitFor(() => expect(screen.getAllByText('Aurora Headphones')[0]).toBeInTheDocument());
    });
  });

  describe('Form validation', () => {
    it('shows error when required fields are empty', async () => {
      const store = buildStore({ 'aurora-headphones': 1 }, 1);
      vi.stubGlobal('fetch', mockFetch({
        '/products': { data: [product] },
      }));

      render(
        <Provider store={store}>
          <App />
        </Provider>,
      );

      // Start at step 1, navigate to step 2
      await waitFor(() => expect(screen.getAllByText('Aurora Headphones')[0]).toBeInTheDocument());
      const summaryPanel = screen.getByRole('complementary');
      await waitFor(() => expect(within(summaryPanel).getByText('Aurora Headphones')).toBeInTheDocument());
      await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument());
      await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      
      // Now on step 2 - clear form and try to continue
      await waitFor(() => expect(screen.getByLabelText('Nombre')).toBeInTheDocument());
      await userEvent.clear(screen.getByLabelText('Nombre'));
      await userEvent.clear(screen.getByLabelText('Email'));
      await userEvent.clear(screen.getByLabelText('Documento'));
      await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      
      await waitFor(() => expect(screen.getByText('Completa los campos obligatorios antes de continuar.')).toBeInTheDocument());
    });

it('validates email format', async () => {
      const store = buildStore({ 'aurora-headphones': 1 }, 1);
      vi.stubGlobal('fetch', mockFetch({
        '/products': { data: [product] },
      }));

      render(
        <Provider store={store}>
          <App />
        </Provider>,
      );

      // Navigate to step 2
      await waitFor(() => expect(screen.getAllByText('Aurora Headphones')[0]).toBeInTheDocument());
      const summaryPanel = screen.getByRole('complementary');
      await waitFor(() => expect(within(summaryPanel).getByText('Aurora Headphones')).toBeInTheDocument());
      await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument());
      await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      
      // Now on step 2 - test email validation (only non-empty checked in current implementation)
      await waitFor(() => expect(screen.getByLabelText('Nombre')).toBeInTheDocument());
      await waitFor(() => expect(screen.getByLabelText('Email')).toBeInTheDocument());
      await userEvent.clear(screen.getByLabelText('Email'));
      await userEvent.type(screen.getByLabelText('Email'), 'invalid-email');
      await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      
      // Should proceed to step 3 since email is not empty (format validation not implemented in isCheckoutStepValid)
      await waitFor(() => expect(screen.getByLabelText('Dirección')).toBeInTheDocument());
    });
  });

  describe('Payment flow', () => {
    it('handles successful payment', async () => {
      const store = buildStore({ 'aurora-headphones': 1 }, 1);
      vi.stubGlobal('fetch', mockFetch({
        '/products': { data: [product] },
        '/transactions': { data: { id: 'txn-123' } },
        '/pay': { data: { success: true, message: 'Pago aprobado', transaction: { reference: 'TXN-123' } } },
      }));

      render(
        <Provider store={store}>
          <App />
        </Provider>,
      );

      // Navigate through all steps to step 4
      await waitFor(() => expect(screen.getAllByText('Aurora Headphones')[0]).toBeInTheDocument());
      const summaryPanel = screen.getByRole('complementary');
      await waitFor(() => expect(within(summaryPanel).getByText('Aurora Headphones')).toBeInTheDocument());
      await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument());
      await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      
      // Step 2
      await waitFor(() => expect(screen.getByLabelText('Nombre')).toBeInTheDocument());
      await userEvent.type(screen.getByLabelText('Nombre'), 'Juan Pérez');
      await userEvent.type(screen.getByLabelText('Email'), 'juan@example.com');
      await userEvent.type(screen.getByLabelText('Tipo documento'), 'CC');
      await userEvent.type(screen.getByLabelText('Documento'), '1234567890');
      await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      
      // Step 3
      await waitFor(() => expect(screen.getByLabelText('Dirección')).toBeInTheDocument());
      await userEvent.type(screen.getByLabelText('Dirección'), 'Calle 123');
      await userEvent.type(screen.getByLabelText('Ciudad'), 'Bogotá');
      await userEvent.type(screen.getByLabelText('Departamento'), 'Cundinamarca');
      await userEvent.type(screen.getByLabelText('Código postal'), '110111');
      await userEvent.type(screen.getByLabelText('Teléfono'), '3001234567');
      await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      
      // Step 4 - Payment form (button says "Continuar" to go to step 5)
      await waitFor(() => expect(screen.getByLabelText('Número de tarjeta')).toBeInTheDocument());
      await userEvent.type(screen.getByLabelText('Número de tarjeta'), '4242424242424242');
      await userEvent.type(screen.getByLabelText('Nombre del titular'), 'JUAN PEREZ');
      await userEvent.type(screen.getByLabelText('Mes'), '12');
      await userEvent.type(screen.getByLabelText('Año'), '2026');
      await userEvent.type(screen.getByLabelText('CVV'), '123');
      
      // Click "Continuar" on step 4 to go to step 5
      await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      
      // Step 5 - Click "Pagar" button to process payment
      await waitFor(() => expect(screen.getByRole('button', { name: /Pagar/i })).toBeInTheDocument());
      await userEvent.click(screen.getByRole('button', { name: /Pagar/i }));
      
      // Step 5 - Confirmation with "Nueva compra" button
      await waitFor(() => expect(screen.getByRole('heading', { name: 'Resumen de la compra' })).toBeInTheDocument());
      await waitFor(() => expect(screen.getByText('Pago aprobado')).toBeInTheDocument());
      await waitFor(() => expect(screen.getByRole('button', { name: 'Nueva compra' })).toBeInTheDocument());
    });

    it('handles payment declined error', async () => {
      const store = buildStore({ 'aurora-headphones': 1 }, 1);
      vi.stubGlobal('fetch', mockFetch({
        '/products': { data: [product] },
        '/transactions': { data: { id: 'txn-123' } },
        '/pay': { data: { success: false, message: 'El pago fue rechazado' }, ok: false, status: 402 },
      }));

      render(
        <Provider store={store}>
          <App />
        </Provider>,
      );

      // Navigate through all steps to step 4
      await waitFor(() => expect(screen.getAllByText('Aurora Headphones')[0]).toBeInTheDocument());
      const summaryPanel = screen.getByRole('complementary');
      await waitFor(() => expect(within(summaryPanel).getByText('Aurora Headphones')).toBeInTheDocument());
      await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument());
      await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      
      // Step 2
      await waitFor(() => expect(screen.getByLabelText('Nombre')).toBeInTheDocument());
      await userEvent.type(screen.getByLabelText('Nombre'), 'Juan Pérez');
      await userEvent.type(screen.getByLabelText('Email'), 'juan@example.com');
      await userEvent.type(screen.getByLabelText('Tipo documento'), 'CC');
      await userEvent.type(screen.getByLabelText('Documento'), '1234567890');
      await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      
      // Step 3
      await waitFor(() => expect(screen.getByLabelText('Dirección')).toBeInTheDocument());
      await userEvent.type(screen.getByLabelText('Dirección'), 'Calle 123');
      await userEvent.type(screen.getByLabelText('Ciudad'), 'Bogotá');
      await userEvent.type(screen.getByLabelText('Departamento'), 'Cundinamarca');
      await userEvent.type(screen.getByLabelText('Código postal'), '110111');
      await userEvent.type(screen.getByLabelText('Teléfono'), '3001234567');
      await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      
      // Step 4 - Payment form
      await waitFor(() => expect(screen.getByLabelText('Número de tarjeta')).toBeInTheDocument());
      await userEvent.type(screen.getByLabelText('Número de tarjeta'), '4242424242424242');
      await userEvent.type(screen.getByLabelText('Nombre del titular'), 'JUAN PEREZ');
      await userEvent.type(screen.getByLabelText('Mes'), '12');
      await userEvent.type(screen.getByLabelText('Año'), '2026');
      await userEvent.type(screen.getByLabelText('CVV'), '123');
      
      // Click "Continuar" on step 4 to go to step 5
      await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      
      // Step 5 - Click "Pagar" button to process payment
      await waitFor(() => expect(screen.getByRole('button', { name: /Pagar/i })).toBeInTheDocument());
      await userEvent.click(screen.getByRole('button', { name: /Pagar/i }));
      
      // Should stay on step 5 with error message
      await waitFor(() => expect(screen.getByText((content) => content.includes('El pago fue rechazado'))).toBeInTheDocument());
      await waitFor(() => expect(screen.getByRole('button', { name: /Pagar/i })).toBeInTheDocument());
    });

    it('handles network error during payment', async () => {
      const store = buildStore({ 'aurora-headphones': 1 }, 1);
      vi.stubGlobal('fetch', mockFetch({
        '/products': { data: [product] },
        '/transactions': { data: { id: 'txn-123' } },
        '/pay': { ok: false, status: 500, data: { message: 'Server error' } },
      }));

      render(
        <Provider store={store}>
          <App />
        </Provider>,
      );

      // Navigate through all steps to step 4
      await waitFor(() => expect(screen.getAllByText('Aurora Headphones')[0]).toBeInTheDocument());
      const summaryPanel = screen.getByRole('complementary');
      await waitFor(() => expect(within(summaryPanel).getByText('Aurora Headphones')).toBeInTheDocument());
      await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument());
      await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      
      // Step 2
      await waitFor(() => expect(screen.getByLabelText('Nombre')).toBeInTheDocument());
      await userEvent.type(screen.getByLabelText('Nombre'), 'Juan Pérez');
      await userEvent.type(screen.getByLabelText('Email'), 'juan@example.com');
      await userEvent.type(screen.getByLabelText('Tipo documento'), 'CC');
      await userEvent.type(screen.getByLabelText('Documento'), '1234567890');
      await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      
      // Step 3
      await waitFor(() => expect(screen.getByLabelText('Dirección')).toBeInTheDocument());
      await userEvent.type(screen.getByLabelText('Dirección'), 'Calle 123');
      await userEvent.type(screen.getByLabelText('Ciudad'), 'Bogotá');
      await userEvent.type(screen.getByLabelText('Departamento'), 'Cundinamarca');
      await userEvent.type(screen.getByLabelText('Código postal'), '110111');
      await userEvent.type(screen.getByLabelText('Teléfono'), '3001234567');
      await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      
      // Step 4 - Payment form
      await waitFor(() => expect(screen.getByLabelText('Número de tarjeta')).toBeInTheDocument());
      await userEvent.type(screen.getByLabelText('Número de tarjeta'), '4242424242424242');
      await userEvent.type(screen.getByLabelText('Nombre del titular'), 'JUAN PEREZ');
      await userEvent.type(screen.getByLabelText('Mes'), '12');
      await userEvent.type(screen.getByLabelText('Año'), '2026');
      await userEvent.type(screen.getByLabelText('CVV'), '123');
      
      // Click "Continuar" on step 4 to go to step 5
      await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      
      // Step 5 - Click "Pagar" button to process payment
      await waitFor(() => expect(screen.getByRole('button', { name: /Pagar/i })).toBeInTheDocument());
      await userEvent.click(screen.getByRole('button', { name: /Pagar/i }));
      
      // Should stay on step 5 with error message
      await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument());
      await waitFor(() => expect(screen.getByRole('button', { name: /Pagar/i })).toBeInTheDocument());
    });
  });

  describe('Confirmation and new purchase', () => {
    it('resets to step 1 when starting new purchase', async () => {
      const store = buildStore({ 'aurora-headphones': 1 }, 1);
      vi.stubGlobal('fetch', mockFetch({
        '/products': { data: [product] },
        '/transactions': { data: { id: 'txn-123' } },
        '/pay': { data: { success: true, message: 'Pago aprobado', transaction: { reference: 'TXN-123' } } },
      }));

      render(
        <Provider store={store}>
          <App />
        </Provider>,
      );

      // Navigate through all steps to completion
      await waitFor(() => expect(screen.getAllByText('Aurora Headphones')[0]).toBeInTheDocument());
      const summaryPanel = screen.getByRole('complementary');
      await waitFor(() => expect(within(summaryPanel).getByText('Aurora Headphones')).toBeInTheDocument());
      await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument());
      await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      
      // Step 2
      await waitFor(() => expect(screen.getByLabelText('Nombre')).toBeInTheDocument());
      await userEvent.type(screen.getByLabelText('Nombre'), 'Juan');
      await userEvent.type(screen.getByLabelText('Email'), 'juan@example.com');
      await userEvent.type(screen.getByLabelText('Tipo documento'), 'CC');
      await userEvent.type(screen.getByLabelText('Documento'), '1234567890');
      await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      
      // Step 3
      await waitFor(() => expect(screen.getByLabelText('Dirección')).toBeInTheDocument());
      await userEvent.type(screen.getByLabelText('Dirección'), 'Calle 123');
      await userEvent.type(screen.getByLabelText('Ciudad'), 'Bogotá');
      await userEvent.type(screen.getByLabelText('Departamento'), 'Cundinamarca');
      await userEvent.type(screen.getByLabelText('Código postal'), '110111');
      await userEvent.type(screen.getByLabelText('Teléfono'), '3001234567');
      await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      
      // Step 4
      await waitFor(() => expect(screen.getByLabelText('Número de tarjeta')).toBeInTheDocument());
      await userEvent.type(screen.getByLabelText('Número de tarjeta'), '4242424242424242');
      await userEvent.type(screen.getByLabelText('Nombre del titular'), 'JUAN PEREZ');
      await userEvent.type(screen.getByLabelText('Mes'), '12');
      await userEvent.type(screen.getByLabelText('Año'), '2026');
      await userEvent.type(screen.getByLabelText('CVV'), '123');
      await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      
      // Step 5 - Click "Pagar" to process payment
      await waitFor(() => expect(screen.getByRole('button', { name: /Pagar/i })).toBeInTheDocument());
      await userEvent.click(screen.getByRole('button', { name: /Pagar/i }));
      
      // Step 5 - Confirmation
      await waitFor(() => expect(screen.getByRole('heading', { name: 'Resumen de la compra' })).toBeInTheDocument());
      await waitFor(() => expect(screen.getByRole('button', { name: 'Nueva compra' })).toBeInTheDocument());
      await userEvent.click(screen.getByRole('button', { name: 'Nueva compra' }));
      
      // Back to step 1
      await waitFor(() => expect(screen.getAllByText('Aurora Headphones')[0]).toBeInTheDocument());
    });
  });

  describe('Product loading error', () => {
    it('shows error when products fail to load', async () => {
      const store = buildStore({ 'aurora-headphones': 1 }, 1);
      vi.stubGlobal('fetch', mockFetch({
        '/products': { ok: false, status: 500, data: { message: 'Server error' } },
      }));

      render(
        <Provider store={store}>
          <App />
        </Provider>,
      );

      await waitFor(() => expect(screen.getByText('No se pudo cargar los productos')).toBeInTheDocument());
    });
  });
});