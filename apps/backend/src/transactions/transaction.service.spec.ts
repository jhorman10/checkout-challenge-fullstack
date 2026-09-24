import { vi } from 'vitest';
import { ProductsService } from '../products/products.service.js';
import { TransactionService } from './transaction.service.js';

describe('TransactionService', () => {
  const withGateway = {
    registerPaymentAttempt: vi.fn().mockResolvedValue({ success: true, providerStatus: 'sandbox-created' }),
    authorizePayment: vi.fn().mockResolvedValue({ success: true, providerStatus: 'sandbox-approved', message: 'ok' }),
  } as any;

  it('creates a pending transaction with calculated fees', async () => {
    const products = new ProductsService(undefined, [
      {
        id: 'sku-1',
        name: 'Earbuds Pro',
        description: 'Wireless earbuds',
        price: 129900,
        stock: 10,
        reserved: false,
        reservedQuantity: 0,
        currency: 'COP',
        imageUrl: 'https://example.com/earbuds.jpg',
      },
    ]);

    const service = new TransactionService(products, withGateway);

    const result = await service.createPendingTransaction({
      productId: 'sku-1',
      quantity: 1,
      customer: {
        name: 'Ana Gomez',
        email: 'ana@example.com',
        documentType: 'CC',
        documentNumber: '1234567890',
      },
      delivery: {
        address: 'Cra 7 # 15-30',
        city: 'Bogota',
        state: 'Cundinamarca',
        postalCode: '110111',
        phone: '+573001112233',
      },
      payment: {
        cardNumber: '4111111111111111',
        holderName: 'ANA GOMEZ',
        expMonth: '12',
        expYear: '2028',
        cvv: '123',
      },
    });

    expect(result.status).toBe('pending');
    expect(result.amount).toBe(129900);
    expect(result.total).toBeGreaterThan(129900);
    expect(result.reference).toMatch(/TXN-/i);
  });

  it('marks the item as reserved until the payment is confirmed', async () => {
    const products = new ProductsService(undefined, [
      {
        id: 'sku-2',
        name: 'Smartwatch',
        description: 'Bluetooth watch',
        price: 500000,
        stock: 3,
        reserved: false,
        reservedQuantity: 0,
        currency: 'COP',
        imageUrl: 'https://example.com/watch.jpg',
      },
    ]);

    const service = new TransactionService(products, withGateway);

    const transaction = await service.createPendingTransaction({
      productId: 'sku-2',
      quantity: 2,
      customer: {
        name: 'Luis Perez',
        email: 'luis@example.com',
        documentType: 'CC',
        documentNumber: '987654321',
      },
      delivery: {
        address: 'Cl 26 # 10-20',
        city: 'Medellin',
        state: 'Antioquia',
        postalCode: '050001',
        phone: '+573002223344',
      },
      payment: {
        cardNumber: '5555555555554444',
        holderName: 'LUIS PEREZ',
        expMonth: '11',
        expYear: '2029',
        cvv: '456',
      },
    });

    const product = products.findProductById('sku-2');

    expect(transaction.status).toBe('pending');
    expect(product?.reserved).toBe(true);
    expect(product?.reservedQuantity).toBe(2);
    expect(product?.stock).toBe(1);
  });

  it('supports multiple products in a single checkout', async () => {
    const products = new ProductsService(undefined, [
      {
        id: 'sku-1',
        name: 'Earbuds Pro',
        description: 'Wireless earbuds',
        price: 129900,
        stock: 10,
        reserved: false,
        reservedQuantity: 0,
        currency: 'COP',
        imageUrl: 'https://example.com/earbuds.jpg',
      },
      {
        id: 'sku-2',
        name: 'Smartwatch',
        description: 'Bluetooth watch',
        price: 500000,
        stock: 3,
        reserved: false,
        reservedQuantity: 0,
        currency: 'COP',
        imageUrl: 'https://example.com/watch.jpg',
      },
    ]);

    const service = new TransactionService(products, withGateway);

    const transaction = await service.createPendingTransaction({
      items: [
        { productId: 'sku-1', quantity: 1 },
        { productId: 'sku-2', quantity: 2 },
      ],
      customer: {
        name: 'Ana Gomez',
        email: 'ana@example.com',
        documentType: 'CC',
        documentNumber: '1234567890',
      },
      delivery: {
        address: 'Cra 7 # 15-30',
        city: 'Bogota',
        state: 'Cundinamarca',
        postalCode: '110111',
        phone: '+573001112233',
      },
      payment: {
        cardNumber: '4111111111111111',
        holderName: 'ANA GOMEZ',
        expMonth: '12',
        expYear: '2028',
        cvv: '123',
      },
    });

    const firstProduct = products.findProductById('sku-1');
    const secondProduct = products.findProductById('sku-2');

    expect(transaction.status).toBe('pending');
    expect(transaction.items).toHaveLength(2);
    expect(firstProduct?.stock).toBe(9);
    expect(secondProduct?.stock).toBe(1);
    expect(transaction.total).toBeGreaterThan(0);
  });

  it('releases reserved stock when payment is rejected', async () => {
    const products = new ProductsService(undefined, [
      {
        id: 'sku-3',
        name: 'Travel Bottle',
        description: 'Reusable bottle',
        price: 50000,
        stock: 2,
        reserved: false,
        reservedQuantity: 0,
        currency: 'COP',
        imageUrl: 'https://example.com/bottle.jpg',
      },
    ]);

    const service = new TransactionService(products, withGateway);
    const transaction = await service.createPendingTransaction({
      productId: 'sku-3',
      quantity: 1,
      customer: {
        name: 'Marta Ruiz',
        email: 'marta@example.com',
        documentType: 'CC',
        documentNumber: '1111111111',
      },
      delivery: {
        address: 'Av 68 # 11-25',
        city: 'Bogota',
        state: 'Cundinamarca',
        postalCode: '110111',
        phone: '+573005556677',
      },
      payment: {
        cardNumber: '1234567890123456',
        holderName: 'MARTA RUIZ',
        expMonth: '10',
        expYear: '2027',
        cvv: '654',
      },
    });

    const rejected = await service.pay({
      transactionId: transaction.id,
      quantity: 1,
      productId: 'sku-3',
      payment: {
        cardNumber: '1234567890123456',
        holderName: 'MARTA RUIZ',
        expMonth: '10',
        expYear: '2027',
        cvv: '654',
      },
      customer: {
        name: 'Marta Ruiz',
        email: 'marta@example.com',
        documentType: 'CC',
        documentNumber: '1111111111',
      },
      delivery: {
        address: 'Av 68 # 11-25',
        city: 'Bogota',
        state: 'Cundinamarca',
        postalCode: '110111',
        phone: '+573005556677',
      },
    });

    const product = products.findProductById('sku-3');

    expect(rejected.success).toBe(false);
    expect(rejected.transaction?.status).toBe('failed');
    expect(product?.reserved).toBe(false);
    expect(product?.reservedQuantity).toBe(0);
    expect(product?.stock).toBe(2);
  });
});
