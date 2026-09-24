import { describe, expect, it } from 'vitest';
import reducer, {
  buildPaymentConfirmation,
  buildPurchaseSummary,
  defaultForm,
  isCheckoutStepUnlocked,
  isCheckoutStepValid,
  setConfirmation,
  setStep,
} from './checkoutSlice';

describe('checkoutSlice', () => {
  it('keeps payment confirmation and order summary as different datasets', () => {
    const paymentConfirmation = buildPaymentConfirmation({
      reference: 'TXN-123',
      amount: 150900,
      customerName: 'Ana Gomez',
      customerEmail: 'ana@example.com',
      status: 'approved',
    });

    const purchaseSummary = buildPurchaseSummary({
      items: [{ productId: 'aurora', name: 'Aurora Headphones', quantity: 1, price: 150900 }],
      total: 150900,
      customerName: 'Ana Gomez',
      customerEmail: 'ana@example.com',
      documentType: 'CC',
      documentNumber: '1020304050',
      address: 'Cra 7 # 15-30',
      city: 'Bogota',
      state: 'Cundinamarca',
      postalCode: '110111',
      phone: '+57 300 123 4567',
    });

    const state = reducer(undefined, setConfirmation(paymentConfirmation));
    const next = reducer(state, setStep(5));

    expect(next.step).toBe(5);
    expect(next.confirmation).toMatchObject({
      reference: 'TXN-123',
      status: 'approved',
      amount: 150900,
    });
    expect(next.confirmation).not.toHaveProperty('items');
    expect(purchaseSummary).toMatchObject({
      total: 150900,
      customerName: 'Ana Gomez',
      city: 'Bogota',
    });
    expect(purchaseSummary).toHaveProperty('items');
    expect(paymentConfirmation).not.toEqual(purchaseSummary);
  });

  it('requires at least one product in the cart to unlock step 2', () => {
    expect(isCheckoutStepUnlocked(2, defaultForm, 0)).toBe(false);
    expect(isCheckoutStepUnlocked(2, defaultForm, 1)).toBe(true);
  });

  it('unlocks each next step only when the previous sections are valid', () => {
    const validForm = {
      ...defaultForm,
      name: 'Ana Gomez',
      email: 'ana@example.com',
      documentNumber: '123456789',
      address: 'Cra 7 # 15-30',
      city: 'Bogota',
      postalCode: '110111',
      phone: '3001234567',
      cardNumber: '4111111111111111',
      holderName: 'ANA GOMEZ',
      expMonth: '12',
      expYear: '2028',
      cvv: '123',
    };

    expect(isCheckoutStepValid(1, validForm, 1)).toBe(true);
    expect(isCheckoutStepUnlocked(2, validForm, 1)).toBe(true);
    expect(isCheckoutStepUnlocked(3, validForm, 1)).toBe(true);
    expect(isCheckoutStepUnlocked(4, validForm, 1)).toBe(true);

    const incompleteForm = { ...validForm, address: '' };
    expect(isCheckoutStepValid(3, incompleteForm, 1)).toBe(false);
    expect(isCheckoutStepUnlocked(4, incompleteForm, 1)).toBe(false);
  });
});
