import { Injectable } from '@nestjs/common';
import { DomainError, domainError } from '../shared/errors.js';
import { Result, err, isErr, ok } from '../shared/result.js';
import { ProductsService } from '../products/products.service.js';
import { WompiService } from '../wompi/wompi.service.js';
import { WompiCustomerDto, WompiCardDto } from '../wompi/dto/wompi.dto.js';

export interface TransactionCustomer {
  name: string;
  email: string;
  documentType: string;
  documentNumber: string;
}

export interface TransactionDelivery {
  address: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
}

export interface PaymentCard {
  cardNumber: string;
  holderName: string;
  expMonth: string;
  expYear: string;
  cvv: string;
}

export interface TransactionItemRequest {
  productId: string;
  quantity: number;
}

export interface CreateTransactionRequest {
  productId?: string;
  quantity?: number;
  items?: TransactionItemRequest[];
  customer: TransactionCustomer;
  delivery: TransactionDelivery;
  payment: PaymentCard;
}

export interface PaymentExecutionRequest {
  transactionId: string;
  productId?: string;
  quantity?: number;
  items?: TransactionItemRequest[];
  customer: TransactionCustomer;
  delivery: TransactionDelivery;
  payment: PaymentCard;
}

export interface TransactionItemRecord {
  productId: string;
  quantity: number;
  amount: number;
}

export interface TransactionRecord {
  id: string;
  reference: string;
  productId: string;
  quantity: number;
  amount: number;
  items: TransactionItemRecord[];
  baseFee: number;
  deliveryFee: number;
  total: number;
  status: 'pending' | 'approved' | 'failed';
  customer: TransactionCustomer;
  delivery: TransactionDelivery;
  providerStatus?: string;
  errorMessage?: string;
  createdAt: string;
}

function toWompiCustomer(customer: TransactionCustomer): WompiCustomerDto {
  const dto = new WompiCustomerDto();
  dto.fullName = customer.name;
  dto.email = customer.email;
  dto.legalId = customer.documentNumber;
  dto.legalIdType = customer.documentType as 'CC' | 'CE' | 'NIT' | 'PP';
  return dto;
}

function toWompiCard(payment: PaymentCard): WompiCardDto {
  const dto = new WompiCardDto();
  dto.number = payment.cardNumber;
  dto.holder = payment.holderName;
  dto.expMonth = payment.expMonth;
  dto.expYear = payment.expYear;
  dto.cvc = payment.cvv;
  return dto;
}

@Injectable()
export class TransactionService {
  private readonly transactions = new Map<string, TransactionRecord>();
  private readonly baseFee = 12000;
  private readonly deliveryFee = 9000;

  constructor(
    private readonly productsService: ProductsService,
    private readonly wompiService: WompiService,
  ) {}

  async createPendingTransaction(
    payload: CreateTransactionRequest,
  ): Promise<Result<TransactionRecord, DomainError>> {
    const items = payload.items && payload.items.length > 0
      ? payload.items
      : payload.productId && typeof payload.quantity === 'number'
        ? [{ productId: payload.productId, quantity: payload.quantity }]
        : [];

    if (items.length === 0) {
      return err(domainError('INVALID_INPUT', 'No products were provided for this transaction'));
    }

    const normalizedItems: TransactionItemRecord[] = [];

    for (const item of items) {
      const stockResult = this.productsService.reserveStock(item.productId, item.quantity);

      if (isErr(stockResult)) {
        return err(stockResult.error);
      }

      const product = stockResult.value;

      normalizedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        amount: product.price * item.quantity,
      });
    }

    const amount = normalizedItems.reduce((sum, item) => sum + item.amount, 0);
    const transactionId = `txn-${Date.now()}`;
    const reference = `TXN-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
    const record: TransactionRecord = {
      id: transactionId,
      reference,
      productId: normalizedItems[0].productId,
      quantity: normalizedItems.reduce((sum, item) => sum + item.quantity, 0),
      amount,
      items: normalizedItems,
      baseFee: this.baseFee,
      deliveryFee: this.deliveryFee,
      total: amount + this.baseFee + this.deliveryFee,
      status: 'pending',
      customer: payload.customer,
      delivery: payload.delivery,
      providerStatus: 'pending',
      createdAt: new Date().toISOString(),
    };

    this.transactions.set(record.id, record);

    // Fire-and-forget registration of payment attempt
    void this.wompiService.registerPaymentAttempt({
      reference,
      amount: record.total,
      currency: 'COP',
      customer: toWompiCustomer(payload.customer),
      transactionId: record.id,
    });

    return ok(record);
  }

  getTransaction(transactionId: string): TransactionRecord | null {
    return this.transactions.get(transactionId) ?? null;
  }

  async pay(
    payload: PaymentExecutionRequest,
  ): Promise<Result<TransactionRecord, DomainError>> {
    const transaction = this.transactions.get(payload.transactionId);

    if (!transaction) {
      return err(domainError('INVALID_INPUT', 'Transaction not found'));
    }

    const itemsToProcess = payload.items && payload.items.length > 0
      ? payload.items
      : payload.productId && typeof payload.quantity === 'number'
        ? [{ productId: payload.productId, quantity: payload.quantity }]
        : transaction.items.map(({ productId, quantity }) => ({ productId, quantity }));

    const wompiResult = await this.wompiService.authorizePayment({
      amount: transaction.total,
      reference: transaction.reference,
      currency: 'COP',
      customer: toWompiCustomer(transaction.customer),
      payment: toWompiCard(payload.payment),
    });

    if (isErr(wompiResult)) {
      // Payment provider error (network, timeout, etc.)
      for (const item of itemsToProcess) {
        this.productsService.releaseReservedStock(item.productId, item.quantity);
      }
      transaction.status = 'failed';
      transaction.providerStatus = 'provider_error';
      transaction.errorMessage = wompiResult.error.message;
      return err(wompiResult.error);
    }

    const { mapped, rawProviderStatus } = wompiResult.value;

    if (mapped.status === 'failed') {
      // Payment declined by provider (DECLINED, ERROR, VOIDED)
      for (const item of itemsToProcess) {
        this.productsService.releaseReservedStock(item.productId, item.quantity);
      }
      transaction.status = 'failed';
      transaction.providerStatus = rawProviderStatus;
      transaction.errorMessage = mapped.error?.message ?? 'Payment rejected by provider';
      return err(mapped.error ?? domainError('PAYMENT_DECLINED', 'Payment rejected by provider'));
    }

    if (mapped.status === 'pending') {
      // Payment pending (e.g., 3DS redirect needed)
      transaction.status = 'pending';
      transaction.providerStatus = rawProviderStatus;
      return ok(transaction);
    }

    // Payment approved
    for (const item of itemsToProcess) {
      this.productsService.completeReservedStock(item.productId);
    }
    transaction.status = 'approved';
    transaction.providerStatus = rawProviderStatus;

    return ok(transaction);
  }
}