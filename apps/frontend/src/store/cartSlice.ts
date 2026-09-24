import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  currency: string;
  imageUrl: string;
};

type CartState = {
  items: Record<string, number>;
};

const STORAGE_KEY = 'wompi-checkout-cart';

const initialState: CartState = {
  items: (() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  })(),
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart: (state, action: PayloadAction<Product>) => {
      const current = state.items[action.payload.id] ?? 0;
      state.items[action.payload.id] = current + 1;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
      }
    },
    updateQuantity: (state, action: PayloadAction<{ productId: string; quantity: number }>) => {
      const nextQuantity = Math.max(0, action.payload.quantity);
      if (nextQuantity === 0) {
        delete state.items[action.payload.productId];
      } else {
        state.items[action.payload.productId] = nextQuantity;
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
      }
    },
    clearCart: (state) => {
      state.items = {};
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({}));
      }
    },
  },
});

export const { addToCart, updateQuantity, clearCart } = cartSlice.actions;
export default cartSlice.reducer;
