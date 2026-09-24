import { configureStore } from '@reduxjs/toolkit';
import cartReducer from './cartSlice';
import checkoutReducer from './checkoutSlice';

export const store = configureStore({
  reducer: {
    cart: cartReducer,
    checkout: checkoutReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
