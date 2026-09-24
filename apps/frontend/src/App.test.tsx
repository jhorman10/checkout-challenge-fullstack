// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

const buildStore = () =>
  configureStore({
    reducer: {
      cart: cartReducer,
      checkout: checkoutReducer,
    },
    preloadedState: {
      cart: { items: { 'aurora-headphones': 1 } },
      checkout: {
        step: 1,
        form: defaultForm,
        status: { type: 'idle' as const, message: '' },
        isSubmitting: false,
        confirmation: null,
      },
    },
  });

describe('App checkout flow', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/products')) {
        return Promise.resolve({
          ok: true,
          json: async () => [product],
        } as Response);
      }

      if (url.includes('/transactions') && !url.includes('/pay')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: 'txn-123' }),
        } as Response);
      }

      if (url.includes('/pay')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            message: 'Pago aprobado',
            transaction: { reference: 'TXN-123' },
          }),
        } as Response);
      }

      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    }));
  });

  it('keeps the purchased items visible in the final summary after payment succeeds', async () => {
    const store = buildStore();

    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(screen.getByLabelText('Nombre')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(screen.getByLabelText('Dirección')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(screen.getByLabelText('Número de tarjeta')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Pagar/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Pagar/i }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Resumen final' })).toBeInTheDocument());

    const summaryHeading = await screen.findByRole('heading', { name: 'Resumen final' });
    const summaryPanel = summaryHeading.closest('aside');

    expect(summaryPanel).not.toBeNull();
    expect(within(summaryPanel as HTMLElement).getByRole('heading', { name: 'Resumen de la compra' })).toBeInTheDocument();

    const productMatches = within(summaryPanel as HTMLElement).getAllByText((_, element) =>
      Boolean(element?.textContent?.includes('Aurora Headphones')),
    );
    expect(productMatches.length).toBeGreaterThan(0);
    expect(within(summaryPanel as HTMLElement).queryByText('Tu carrito está vacío.')).not.toBeInTheDocument();
  });

  it('announces and animates the newly selected checkout step', async () => {
    const store = buildStore();

    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    const stepHeading = await screen.findByRole('heading', { name: 'Paso 2: Cliente' });

    expect(stepHeading).toHaveFocus();
    expect(stepHeading.parentElement).toHaveClass('step-screen-enter');
  });
});
