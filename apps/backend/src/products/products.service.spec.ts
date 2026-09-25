import { describe, expect, it } from 'vitest';
import { isErr, isOk } from '../shared/result.js';
import { ProductsService } from './products.service.js';

const sampleProduct = {
  id: 'prod-test',
  name: 'Test Product',
  description: 'A test product',
  price: 100000,
  stock: 10,
  reserved: false,
  reservedQuantity: 0,
  currency: 'COP',
  imageUrl: 'https://example.com/test.jpg',
};

describe('ProductsService', () => {
  function createService(products = [sampleProduct]) {
    return new ProductsService(undefined, products);
  }

  describe('listProducts', () => {
    it('returns a copy of all products', () => {
      const service = createService();
      const result = service.listProducts();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('prod-test');
    });

    it('returns an empty array when no products are configured', () => {
      const service = createService([]);
      expect(service.listProducts()).toHaveLength(0);
    });
  });

  describe('findProductById', () => {
    it('returns the product when found', () => {
      const service = createService();
      expect(service.findProductById('prod-test')?.id).toBe('prod-test');
    });

    it('returns undefined when not found', () => {
      const service = createService();
      expect(service.findProductById('nonexistent')).toBeUndefined();
    });
  });

  describe('reserveStock', () => {
    it('reserves stock and returns Ok with the updated product', () => {
      const service = createService();
      const result = service.reserveStock('prod-test', 3);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.stock).toBe(7);
        expect(result.value.reserved).toBe(true);
        expect(result.value.reservedQuantity).toBe(3);
      }
    });

    it('returns Err(PRODUCT_NOT_FOUND) for unknown product', () => {
      const service = createService();
      const result = service.reserveStock('unknown', 1);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('PRODUCT_NOT_FOUND');
      }
    });

    it('returns Err(INSUFFICIENT_STOCK) when quantity exceeds stock', () => {
      const service = createService([
        { ...sampleProduct, stock: 2, reserved: false, reservedQuantity: 0 },
      ]);
      const result = service.reserveStock('prod-test', 5);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('INSUFFICIENT_STOCK');
      }
      // Stock must remain unchanged on failure
      expect(service.findProductById('prod-test')?.stock).toBe(2);
    });
  });

  describe('releaseReservedStock', () => {
    it('returns stock and returns Ok with the updated product', () => {
      const service = createService([
        { ...sampleProduct, stock: 5, reserved: true, reservedQuantity: 3 },
      ]);
      const result = service.releaseReservedStock('prod-test', 3);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.stock).toBe(8);
        expect(result.value.reserved).toBe(false);
        expect(result.value.reservedQuantity).toBe(0);
      }
    });

    it('returns Err(PRODUCT_NOT_FOUND) for unknown product', () => {
      const service = createService();
      const result = service.releaseReservedStock('unknown', 1);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('PRODUCT_NOT_FOUND');
      }
    });
  });

  describe('completeReservedStock', () => {
    it('clears reservation and returns Ok with the updated product', () => {
      const service = createService([
        { ...sampleProduct, stock: 3, reserved: true, reservedQuantity: 2 },
      ]);
      const result = service.completeReservedStock('prod-test');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.reserved).toBe(false);
        expect(result.value.reservedQuantity).toBe(0);
        // Stock is NOT replenished on completion (reservation is finalised)
        expect(result.value.stock).toBe(3);
      }
    });

    it('returns Err(PRODUCT_NOT_FOUND) for unknown product', () => {
      const service = createService();
      const result = service.completeReservedStock('unknown');

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('PRODUCT_NOT_FOUND');
      }
    });
  });
});
