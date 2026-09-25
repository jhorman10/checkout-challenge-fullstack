import { describe, expect, it, vi } from 'vitest';
import cartReducer, { addToCart, updateQuantity, clearCart } from './cartSlice';

vi.mock('localStorage', () => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}));

describe('cartSlice', () => {
  const initialState = { items: {} };

  it('should return initial state', () => {
    expect(cartReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  describe('addToCart', () => {
    it('should add a new product to empty cart', () => {
      const product = { id: 'prod-1', name: 'Product 1', price: 100, stock: 10, currency: 'COP', description: '', imageUrl: '' };
      const state = cartReducer(initialState, addToCart(product));
      expect(state.items['prod-1']).toBe(1);
    });

    it('should increment quantity when adding existing product', () => {
      const product = { id: 'prod-1', name: 'Product 1', price: 100, stock: 10, currency: 'COP', description: '', imageUrl: '' };
      let state = cartReducer(initialState, addToCart(product));
      state = cartReducer(state, addToCart(product));
      expect(state.items['prod-1']).toBe(2);
    });

    it('should handle multiple different products', () => {
      const product1 = { id: 'prod-1', name: 'Product 1', price: 100, stock: 10, currency: 'COP', description: '', imageUrl: '' };
      const product2 = { id: 'prod-2', name: 'Product 2', price: 200, stock: 5, currency: 'COP', description: '', imageUrl: '' };
      let state = cartReducer(initialState, addToCart(product1));
      state = cartReducer(state, addToCart(product2));
      expect(state.items['prod-1']).toBe(1);
      expect(state.items['prod-2']).toBe(1);
    });
  });

  describe('updateQuantity', () => {
    it('should update quantity for existing product', () => {
      const product = { id: 'prod-1', name: 'Product 1', price: 100, stock: 10, currency: 'COP', description: '', imageUrl: '' };
      let state = cartReducer(initialState, addToCart(product));
      state = cartReducer(state, updateQuantity({ productId: 'prod-1', quantity: 5 }));
      expect(state.items['prod-1']).toBe(5);
    });

    it('should remove product when quantity is 0', () => {
      const product = { id: 'prod-1', name: 'Product 1', price: 100, stock: 10, currency: 'COP', description: '', imageUrl: '' };
      let state = cartReducer(initialState, addToCart(product));
      state = cartReducer(state, updateQuantity({ productId: 'prod-1', quantity: 0 }));
      expect(state.items['prod-1']).toBeUndefined();
    });

    it('should remove product when quantity is negative', () => {
      const product = { id: 'prod-1', name: 'Product 1', price: 100, stock: 10, currency: 'COP', description: '', imageUrl: '' };
      let state = cartReducer(initialState, addToCart(product));
      state = cartReducer(state, updateQuantity({ productId: 'prod-1', quantity: -1 }));
      expect(state.items['prod-1']).toBeUndefined();
    });

    it('should not affect other products', () => {
      const product1 = { id: 'prod-1', name: 'Product 1', price: 100, stock: 10, currency: 'COP', description: '', imageUrl: '' };
      const product2 = { id: 'prod-2', name: 'Product 2', price: 200, stock: 5, currency: 'COP', description: '', imageUrl: '' };
      let state = cartReducer(initialState, addToCart(product1));
      state = cartReducer(state, addToCart(product2));
      state = cartReducer(state, updateQuantity({ productId: 'prod-1', quantity: 3 }));
      expect(state.items['prod-1']).toBe(3);
      expect(state.items['prod-2']).toBe(1);
    });
  });

  describe('clearCart', () => {
    it('should clear all items', () => {
      const product1 = { id: 'prod-1', name: 'Product 1', price: 100, stock: 10, currency: 'COP', description: '', imageUrl: '' };
      const product2 = { id: 'prod-2', name: 'Product 2', price: 200, stock: 5, currency: 'COP', description: '', imageUrl: '' };
      let state = cartReducer(initialState, addToCart(product1));
      state = cartReducer(state, addToCart(product2));
      state = cartReducer(state, clearCart());
      expect(state.items).toEqual({});
    });

    it('should handle clearing empty cart', () => {
      const state = cartReducer(initialState, clearCart());
      expect(state.items).toEqual({});
    });
  });
});