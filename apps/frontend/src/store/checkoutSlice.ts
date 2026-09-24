import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type FormState = {
  name: string;
  email: string;
  documentType: string;
  documentNumber: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
  cardNumber: string;
  holderName: string;
  expMonth: string;
  expYear: string;
  cvv: string;
};

export type CheckoutStatus = {
  type: 'idle' | 'success' | 'error';
  message: string;
};

export type PurchaseItem = {
  productId: string;
  name: string;
  quantity: number;
  price: number;
};

export type PaymentConfirmation = {
  status: 'approved';
  reference: string;
  amount: number;
  customerName: string;
  customerEmail: string;
};

export type PurchaseSummary = {
  items: PurchaseItem[];
  total: number;
  reference: string;
  customerName: string;
  customerEmail: string;
  documentType: string;
  documentNumber: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
};

export type CheckoutState = {
  step: number;
  form: FormState;
  status: CheckoutStatus;
  isSubmitting: boolean;
  confirmation: PaymentConfirmation | null;
};

export const isCheckoutStepValid = (step: number, form: FormState, cartItemCount: number): boolean => {
  if (step === 1) {
    return cartItemCount > 0;
  }

  if (step === 2) {
    return !!form.name.trim() && !!form.email.trim() && !!form.documentNumber.trim();
  }

  if (step === 3) {
    return !!form.address.trim() && !!form.city.trim() && !!form.postalCode.trim() && !!form.phone.trim();
  }

  if (step === 4) {
    return !!form.cardNumber.trim() && !!form.holderName.trim() && !!form.expMonth.trim() && !!form.expYear.trim() && !!form.cvv.trim();
  }

  return true;
};

export const isCheckoutStepUnlocked = (step: number, form: FormState, cartItemCount: number): boolean => {
  if (step === 1) {
    return true;
  }

  for (let currentStep = 1; currentStep < step; currentStep += 1) {
    if (!isCheckoutStepValid(currentStep, form, cartItemCount)) {
      return false;
    }
  }

  return true;
};

export const buildPaymentConfirmation = ({
  reference,
  amount,
  customerName,
  customerEmail,
  status = 'approved',
}: {
  reference: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  status?: 'approved';
}): PaymentConfirmation => ({
  status,
  reference,
  amount,
  customerName,
  customerEmail,
});

export const buildPurchaseSummary = ({
  items,
  total,
  customerName,
  customerEmail,
  documentType,
  documentNumber,
  address,
  city,
  state,
  postalCode,
  phone,
}: {
  items: PurchaseItem[];
  total: number;
  customerName: string;
  customerEmail: string;
  documentType: string;
  documentNumber: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
  reference?: string;
}): PurchaseSummary => ({
  items,
  total,
  reference: '',
  customerName,
  customerEmail,
  documentType,
  documentNumber,
  address,
  city,
  state,
  postalCode,
  phone,
});

export const defaultForm: FormState = {
  name: 'Ana García',
  email: 'ana.garcia@example.com',
  documentType: 'CC',
  documentNumber: '1020304050',
  address: 'Carrera 15 # 92-30',
  city: 'Bogotá',
  state: 'Bogotá D.C.',
  postalCode: '110111',
  phone: '+57 300 123 4567',
  cardNumber: '4111111111111111',
  holderName: 'ANA GARCIA',
  expMonth: '12',
  expYear: '2028',
  cvv: '123',
};

const initialState: CheckoutState = {
  step: 1,
  form: defaultForm,
  status: { type: 'idle', message: '' },
  isSubmitting: false,
  confirmation: null,
};

const checkoutSlice = createSlice({
  name: 'checkout',
  initialState,
  reducers: {
    setField: (state, action: PayloadAction<{ field: keyof FormState; value: string }>) => {
      state.form[action.payload.field] = action.payload.value;
    },
    setStep: (state, action: PayloadAction<number>) => {
      state.step = action.payload;
    },
    nextStep: (state) => {
      state.step = Math.min(5, state.step + 1);
    },
    previousStep: (state) => {
      state.step = Math.max(1, state.step - 1);
    },
    setStatus: (state, action: PayloadAction<CheckoutStatus>) => {
      state.status = action.payload;
    },
    setSubmitting: (state, action: PayloadAction<boolean>) => {
      state.isSubmitting = action.payload;
    },
    setConfirmation: (state, action: PayloadAction<PaymentConfirmation>) => {
      state.confirmation = action.payload;
    },
    clearConfirmation: (state) => {
      state.confirmation = null;
    },
    resetCheckout: () => initialState,
  },
});

export const {
  setField,
  setStep,
  nextStep,
  previousStep,
  setStatus,
  setSubmitting,
  setConfirmation,
  clearConfirmation,
  resetCheckout,
} = checkoutSlice.actions;
export default checkoutSlice.reducer;
