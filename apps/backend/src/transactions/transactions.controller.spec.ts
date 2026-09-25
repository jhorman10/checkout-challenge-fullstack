import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, NotFoundException } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { TransactionsController } from './transactions.controller.js';
import { TransactionService, CreateTransactionRequest, PaymentExecutionRequest } from './transaction.service.js';
import { ok, err, isOk, isErr } from '../shared/result.js';
import { domainError } from '../shared/errors.js';
import { WompiTransactionStatus } from '../wompi/dto/wompi.dto.js';

describe('TransactionsController', () => {
  let controller: TransactionsController;
  let mockTransactionService: any;

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

  beforeEach(async () => {
    mockTransactionService = {
      createPendingTransaction: vi.fn(),
      getTransaction: vi.fn(),
      pay: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 10 }] })],
      controllers: [TransactionsController],
      providers: [
        {
          provide: TransactionService,
          useValue: mockTransactionService,
        },
      ],
    }).compile();

    controller = module.get<TransactionsController>(TransactionsController);
    vi.clearAllMocks();
  });

  describe('createTransaction', () => {
    it('creates transaction successfully', async () => {
      const mockResult = ok({
        id: 'txn-123',
        status: 'pending',
        amount: 129900,
        total: 150900,
        reference: 'TXN-123456789',
        createdAt: new Date().toISOString(),
      });

      mockTransactionService.createPendingTransaction.mockResolvedValue(mockResult);

      const payload = {
        productId: 'sku-1',
        quantity: 1,
        customer,
        delivery,
        payment,
      };

      const result = await controller.createTransaction(payload);

      expect(result).toEqual(mockResult.value);
      expect(mockTransactionService.createPendingTransaction).toHaveBeenCalledWith({
        productId: 'sku-1',
        quantity: 1,
        items: undefined,
        customer,
        delivery,
        payment,
      });
    });

    it('creates transaction with multiple items', async () => {
      const mockResult = ok({
        id: 'txn-123',
        status: 'pending',
        amount: 259800,
        total: 280800,
        reference: 'TXN-123456789',
        createdAt: new Date().toISOString(),
      });

      mockTransactionService.createPendingTransaction.mockResolvedValue(mockResult);

      const payload = {
        items: [
          { productId: 'sku-1', quantity: 1 },
          { productId: 'sku-2', quantity: 2 },
        ],
        customer,
        delivery,
        payment,
      };

      const result = await controller.createTransaction(payload);

      expect(result).toEqual(mockResult.value);
      expect(mockTransactionService.createPendingTransaction).toHaveBeenCalledWith({
        productId: undefined,
        quantity: undefined,
        items: [
          { productId: 'sku-1', quantity: 1 },
          { productId: 'sku-2', quantity: 2 },
        ],
        customer,
        delivery,
        payment,
      });
    });

    it('throws HttpException for INVALID_INPUT', async () => {
      const mockResult = err(domainError('INVALID_INPUT', 'No products provided'));
      mockTransactionService.createPendingTransaction.mockResolvedValue(mockResult);

      const payload = {
        customer,
        delivery,
        payment,
      };

      await expect(controller.createTransaction(payload)).rejects.toThrow(HttpException);
      await expect(controller.createTransaction(payload)).rejects.toMatchObject({
        response: { message: 'No products provided', code: 'INVALID_INPUT' },
        status: 400,
      });
    });

    it('throws HttpException for PRODUCT_NOT_FOUND', async () => {
      const mockResult = err(domainError('PRODUCT_NOT_FOUND', 'Product not found'));
      mockTransactionService.createPendingTransaction.mockResolvedValue(mockResult);

      const payload = {
        productId: 'sku-missing',
        quantity: 1,
        customer,
        delivery,
        payment,
      };

      await expect(controller.createTransaction(payload)).rejects.toThrow(HttpException);
      await expect(controller.createTransaction(payload)).rejects.toMatchObject({
        response: { message: 'Product not found', code: 'PRODUCT_NOT_FOUND' },
        status: 404,
      });
    });

    it('throws HttpException for INSUFFICIENT_STOCK', async () => {
      const mockResult = err(domainError('INSUFFICIENT_STOCK', 'Insufficient stock'));
      mockTransactionService.createPendingTransaction.mockResolvedValue(mockResult);

      const payload = {
        productId: 'sku-1',
        quantity: 100,
        customer,
        delivery,
        payment,
      };

      await expect(controller.createTransaction(payload)).rejects.toThrow(HttpException);
      await expect(controller.createTransaction(payload)).rejects.toMatchObject({
        response: { message: 'Insufficient stock', code: 'INSUFFICIENT_STOCK' },
        status: 400,
      });
    });

    it('throws HttpException for DUPLICATE_OPERATION', async () => {
      const mockResult = err(domainError('DUPLICATE_OPERATION', 'Duplicate'));
      mockTransactionService.createPendingTransaction.mockResolvedValue(mockResult);

      const payload = {
        productId: 'sku-1',
        quantity: 1,
        customer,
        delivery,
        payment,
      };

      await expect(controller.createTransaction(payload)).rejects.toThrow(HttpException);
      await expect(controller.createTransaction(payload)).rejects.toMatchObject({
        response: { message: 'Duplicate', code: 'DUPLICATE_OPERATION' },
        status: 409,
      });
    });
  });

  describe('getTransaction', () => {
    it('returns transaction when found', async () => {
      const mockTransaction = {
        id: 'txn-123',
        status: 'approved',
        amount: 129900,
        total: 150900,
        reference: 'TXN-123456789',
        createdAt: new Date().toISOString(),
      };

      mockTransactionService.getTransaction.mockReturnValue(mockTransaction);

      const result = await controller.getTransaction('txn-123');

      expect(result).toEqual(mockTransaction);
      expect(mockTransactionService.getTransaction).toHaveBeenCalledWith('txn-123');
    });

    it('throws NotFoundException when not found', async () => {
      mockTransactionService.getTransaction.mockReturnValue(null);

      try {
        await controller.getTransaction('txn-missing');
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.message).toBe('Transaction not found');
      }
    });
  });

  describe('payTransaction', () => {
    it('processes payment successfully', async () => {
      const mockResult = ok({
        id: 'txn-123',
        status: 'approved',
        providerStatus: 'APPROVED',
        amount: 129900,
        total: 150900,
        reference: 'TXN-123456789',
        createdAt: new Date().toISOString(),
      });

      mockTransactionService.pay.mockResolvedValue(mockResult);

      const payload = {
        productId: 'sku-1',
        quantity: 1,
        customer,
        delivery,
        payment,
      };

      const result = await controller.payTransaction('txn-123', payload);

      expect(result).toEqual({
        success: true,
        message: 'Pago aprobado',
        transaction: mockResult.value,
      });
      expect(mockTransactionService.pay).toHaveBeenCalledWith({
        transactionId: 'txn-123',
        productId: 'sku-1',
        quantity: 1,
        items: undefined,
        customer,
        delivery,
        payment,
      });
    });

    it('returns pending message when status is pending', async () => {
      const mockResult = ok({
        id: 'txn-123',
        status: 'pending',
        providerStatus: 'PENDING',
        amount: 129900,
        total: 150900,
        reference: 'TXN-123456789',
        createdAt: new Date().toISOString(),
      });

      mockTransactionService.pay.mockResolvedValue(mockResult);

      const payload = {
        productId: 'sku-1',
        quantity: 1,
        customer,
        delivery,
        payment,
      };

      const result = await controller.payTransaction('txn-123', payload);

      expect(result.message).toBe('Pago pendiente');
    });

    it('throws HttpException for PAYMENT_DECLINED (402)', async () => {
      const mockResult = err(domainError('PAYMENT_DECLINED', 'Card declined'));
      mockTransactionService.pay.mockResolvedValue(mockResult);

      const payload = {
        productId: 'sku-1',
        quantity: 1,
        customer,
        delivery,
        payment,
      };

      await expect(controller.payTransaction('txn-123', payload)).rejects.toThrow(HttpException);
      await expect(controller.payTransaction('txn-123', payload)).rejects.toMatchObject({
        response: { message: 'Card declined', code: 'PAYMENT_DECLINED' },
        status: 402,
      });
    });

    it('throws HttpException for INVALID_INPUT when transaction not found', async () => {
      const mockResult = err(domainError('INVALID_INPUT', 'Transaction not found'));
      mockTransactionService.pay.mockResolvedValue(mockResult);

      const payload = {
        productId: 'sku-1',
        quantity: 1,
        customer,
        delivery,
        payment,
      };

      await expect(controller.payTransaction('txn-missing', payload)).rejects.toThrow(HttpException);
      await expect(controller.payTransaction('txn-missing', payload)).rejects.toMatchObject({
        response: { message: 'Transaction not found', code: 'INVALID_INPUT' },
        status: 400,
      });
    });

    it('throws HttpException for PROVIDER_ERROR (502)', async () => {
      const mockResult = err(domainError('PROVIDER_ERROR', 'Payment provider unavailable'));
      mockTransactionService.pay.mockResolvedValue(mockResult);

      const payload = {
        productId: 'sku-1',
        quantity: 1,
        customer,
        delivery,
        payment,
      };

      await expect(controller.payTransaction('txn-123', payload)).rejects.toThrow(HttpException);
      await expect(controller.payTransaction('txn-123', payload)).rejects.toMatchObject({
        response: { message: 'Payment provider unavailable', code: 'PROVIDER_ERROR' },
        status: 502,
      });
    });

    it('throws HttpException for DUPLICATE_OPERATION (409)', async () => {
      const mockResult = err(domainError('DUPLICATE_OPERATION', 'Duplicate payment'));
      mockTransactionService.pay.mockResolvedValue(mockResult);

      const payload = {
        productId: 'sku-1',
        quantity: 1,
        customer,
        delivery,
        payment,
      };

      await expect(controller.payTransaction('txn-123', payload)).rejects.toThrow(HttpException);
      await expect(controller.payTransaction('txn-123', payload)).rejects.toMatchObject({
        response: { message: 'Duplicate payment', code: 'DUPLICATE_OPERATION' },
        status: 409,
      });
    });
  });
});