import { vi } from 'vitest';
import { ok, isOk, isErr } from '../shared/result.js';
import { domainError } from '../shared/errors.js';
import { ProductsService } from '../products/products.service.js';
import { TransactionService } from './transaction.service.js';
import { WompiTransactionStatus } from '../wompi/dto/wompi.dto.js';

describe('TransactionService', () => {
  const withGateway = {
    registerPaymentAttempt: vi.fn().mockResolvedValue(ok({
      mapped: { status: 'pending', providerStatus: WompiTransactionStatus.PENDING },
      rawProviderStatus: 'PENDING',
    })),
    authorizePayment: vi.fn().mockResolvedValue(ok({
      mapped: { status: 'approved', providerStatus: WompiTransactionStatus.APPROVED },
      rawProviderStatus: 'APPROVED',
    })),
  } as any;

  const customer = {
    name: 'Ana Gomez',
    email: 'ana@example.com',
    documentType: 'CC',
    documentNumber: '1234567890',
  };

  const delivery = {
    address: 'Cra 7 # 15-30',
    city: 'Bogota',
    state: 'Cundinamarca',
    postalCode: '110111',
    phone: '+573001112233',
  };

  const payment = {
    cardNumber: '4111111111111111',
    holderName: 'ANA GOMEZ',
    expMonth: '12',
    expYear: '2028',
    cvv: '123',
  };

  function createProducts(overrides: Partial<{
    id: string;
    name: string;
    price: number;
    stock: number;
  }>[] = []) {
    const defaults = [
      { id: 'sku-1', name: 'Earbuds Pro', description: 'Wireless earbuds', price: 129900, stock: 10, reserved: false, reservedQuantity: 0, currency: 'COP', imageUrl: 'https://example.com/earbuds.jpg' },
      { id: 'sku-2', name: 'Smartwatch', description: 'Bluetooth watch', price: 500000, stock: 3, reserved: false, reservedQuantity: 0, currency: 'COP', imageUrl: 'https://example.com/watch.jpg' },
      { id: 'sku-3', name: 'Travel Bottle', description: 'Reusable bottle', price: 50000, stock: 2, reserved: false, reservedQuantity: 0, currency: 'COP', imageUrl: 'https://example.com/bottle.jpg' },
    ];

    return new ProductsService(
      undefined,
      defaults.map((d, i) => ({ ...d, ...overrides[i] })),
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    withGateway.registerPaymentAttempt.mockResolvedValue(ok({
      mapped: { status: 'pending', providerStatus: WompiTransactionStatus.PENDING },
      rawProviderStatus: 'PENDING',
    }));
    withGateway.authorizePayment.mockResolvedValue(ok({
      mapped: { status: 'approved', providerStatus: WompiTransactionStatus.APPROVED },
      rawProviderStatus: 'APPROVED',
    }));
  });

  describe('createPendingTransaction', () => {
    it('creates a pending transaction with calculated fees', async () => {
      const products = createProducts();
      const service = new TransactionService(products, withGateway);

      const result = await service.createPendingTransaction({
        productId: 'sku-1',
        quantity: 1,
        customer,
        delivery,
        payment,
      });

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const record = result.value;
      expect(record.status).toBe('pending');
      expect(record.amount).toBe(129900);
      expect(record.total).toBeGreaterThan(129900);
      expect(record.reference).toMatch(/TXN-/i);
    });

    it('marks the item as reserved until the payment is confirmed', async () => {
      const products = createProducts();
      const service = new TransactionService(products, withGateway);

      const result = await service.createPendingTransaction({
        productId: 'sku-2',
        quantity: 2,
        customer,
        delivery,
        payment,
      });

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const transaction = result.value;
      const product = products.findProductById('sku-2');

      expect(transaction.status).toBe('pending');
      expect(product?.reserved).toBe(true);
      expect(product?.reservedQuantity).toBe(2);
      expect(product?.stock).toBe(1);
    });

    it('supports multiple products in a single checkout', async () => {
      const products = createProducts();
      const service = new TransactionService(products, withGateway);

      const result = await service.createPendingTransaction({
        items: [
          { productId: 'sku-1', quantity: 1 },
          { productId: 'sku-2', quantity: 2 },
        ],
        customer,
        delivery,
        payment,
      });

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const transaction = result.value;
      const firstProduct = products.findProductById('sku-1');
      const secondProduct = products.findProductById('sku-2');

      expect(transaction.status).toBe('pending');
      expect(transaction.items).toHaveLength(2);
      expect(firstProduct?.stock).toBe(9);
      expect(secondProduct?.stock).toBe(1);
      expect(transaction.total).toBeGreaterThan(0);
    });

    it('returns Err(INVALID_INPUT) when no products are provided', async () => {
      const products = createProducts();
      const service = new TransactionService(products, withGateway);

      const result = await service.createPendingTransaction({
        customer,
        delivery,
        payment,
      });

      expect(isErr(result)).toBe(true);
      if (!isErr(result)) return;

      expect(result.error.code).toBe('INVALID_INPUT');
    });

    it('returns Err(PRODUCT_NOT_FOUND) for a non-existent product', async () => {
      const products = createProducts();
      const service = new TransactionService(products, withGateway);

      const result = await service.createPendingTransaction({
        productId: 'sku-missing',
        quantity: 1,
        customer,
        delivery,
        payment,
      });

      expect(isErr(result)).toBe(true);
      if (!isErr(result)) return;

      expect(result.error.code).toBe('PRODUCT_NOT_FOUND');
    });

    it('returns Err(INSUFFICIENT_STOCK) when quantity exceeds stock', async () => {
      const products = createProducts([{ stock: 1 }]);
      const service = new TransactionService(products, withGateway);

      const result = await service.createPendingTransaction({
        productId: 'sku-1',
        quantity: 5,
        customer,
        delivery,
        payment,
      });

      expect(isErr(result)).toBe(true);
      if (!isErr(result)) return;

      expect(result.error.code).toBe('INSUFFICIENT_STOCK');
      // Stock should not be modified on failure
      expect(products.findProductById('sku-1')?.stock).toBe(1);
    });
  });

  describe('pay', () => {
    it('completes the payment and approves the transaction', async () => {
      const products = createProducts();
      const service = new TransactionService(products, withGateway);

      const createResult = await service.createPendingTransaction({
        productId: 'sku-1',
        quantity: 1,
        customer,
        delivery,
        payment,
      });

      expect(isOk(createResult)).toBe(true);
      if (!isOk(createResult)) return;

      const transaction = createResult.value;

      withGateway.authorizePayment.mockResolvedValueOnce(ok({
        mapped: { status: 'approved', providerStatus: WompiTransactionStatus.APPROVED },
        rawProviderStatus: 'APPROVED',
      }));

      const payResult = await service.pay({
        transactionId: transaction.id,
        quantity: 1,
        productId: 'sku-1',
        payment,
        customer,
        delivery,
      });

      expect(isOk(payResult)).toBe(true);
      if (!isOk(payResult)) return;

      const record = payResult.value;
      expect(record.status).toBe('approved');
      expect(record.providerStatus).toBe('APPROVED');

      const product = products.findProductById('sku-1');
      expect(product?.reserved).toBe(false);
      expect(product?.reservedQuantity).toBe(0);
    });

    it('releases reserved stock and returns Err(PAYMENT_DECLINED) on provider rejection', async () => {
      const products = createProducts();
      const service = new TransactionService(products, withGateway);

      const createResult = await service.createPendingTransaction({
        productId: 'sku-3',
        quantity: 1,
        customer,
        delivery,
        payment,
      });

      expect(isOk(createResult)).toBe(true);
      if (!isOk(createResult)) return;

      const transaction = createResult.value;

      // Override the gateway to simulate a declined payment
      withGateway.authorizePayment.mockResolvedValueOnce(ok({
        mapped: {
          status: 'failed',
          providerStatus: WompiTransactionStatus.DECLINED,
          error: domainError('PAYMENT_DECLINED', 'Card declined by provider'),
        },
        rawProviderStatus: 'DECLINED',
      }));

      const rejected = await service.pay({
        transactionId: transaction.id,
        quantity: 1,
        productId: 'sku-3',
        payment,
        customer,
        delivery,
      });

      expect(isErr(rejected)).toBe(true);
      if (!isErr(rejected)) return;

      expect(rejected.error.code).toBe('PAYMENT_DECLINED');

      const product = products.findProductById('sku-3');
      expect(product?.reserved).toBe(false);
      expect(product?.reservedQuantity).toBe(0);
      expect(product?.stock).toBe(2);
    });

    it('returns Err(INVALID_INPUT) when the transaction does not exist', async () => {
      const products = createProducts();
      const service = new TransactionService(products, withGateway);

      const result = await service.pay({
        transactionId: 'txn-nonexistent',
        quantity: 1,
        productId: 'sku-1',
        payment,
        customer,
        delivery,
      });

      expect(isErr(result)).toBe(true);
      if (!isErr(result)) return;

      expect(result.error.code).toBe('INVALID_INPUT');
      expect(result.error.message).toBe('Transaction not found');
    });

    it('returns Err(PAYMENT_DECLINED) when provider returns failure for non-matching card', async () => {
      const products = createProducts();
      const service = new TransactionService(products, withGateway);

      const createResult = await service.createPendingTransaction({
        productId: 'sku-1',
        quantity: 1,
        customer,
        delivery,
        payment: {
          ...payment,
          cardNumber: '1234567890123456',
        },
      });

      expect(isOk(createResult)).toBe(true);
      if (!isOk(createResult)) return;

      const transaction = createResult.value;

      // With the local card-prefix gate removed, rejection comes from the provider
      withGateway.authorizePayment.mockResolvedValueOnce(ok({
        mapped: {
          status: 'failed',
          providerStatus: WompiTransactionStatus.ERROR,
          error: domainError('PROVIDER_ERROR', 'Processing error'),
        },
        rawProviderStatus: 'ERROR',
      }));

      const rejected = await service.pay({
        transactionId: transaction.id,
        quantity: 1,
        productId: 'sku-1',
        payment: {
          ...payment,
          cardNumber: '1234567890123456',
        },
        customer,
        delivery,
      });

      expect(isErr(rejected)).toBe(true);
      if (!isErr(rejected)) return;

      expect(rejected.error.code).toBe('PROVIDER_ERROR');
      expect(rejected.error.message).toBe('Processing error');

      const product = products.findProductById('sku-1');
      expect(product?.reserved).toBe(false);
      expect(product?.stock).toBe(10);
    });
  });

  describe('getTransaction', () => {
    it('returns the transaction when it exists', async () => {
      const products = createProducts();
      const service = new TransactionService(products, withGateway);

      const result = await service.createPendingTransaction({
        productId: 'sku-1',
        quantity: 1,
        customer,
        delivery,
        payment,
      });

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const transaction = service.getTransaction(result.value.id);

      expect(transaction).not.toBeNull();
      expect(transaction?.id).toBe(result.value.id);
    });

    it('returns null when the transaction does not exist', () => {
      const products = createProducts();
      const service = new TransactionService(products, withGateway);

      expect(service.getTransaction('txn-missing')).toBeNull();
    });
  });
});