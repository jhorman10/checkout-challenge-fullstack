import { BadRequestException, Injectable } from '@nestjs/common';
import { ProductsService } from '../products/products.service.js';
import { WompiService } from '../wompi/wompi.service.js';

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

@Injectable()
export class TransactionService {
  private readonly transactions = new Map<string, TransactionRecord>();
  private readonly baseFee = 12000;
  private readonly deliveryFee = 9000;

  constructor(
    private readonly productsService: ProductsService,
    private readonly wompiService: WompiService,
  ) {}

  async createPendingTransaction(payload: CreateTransactionRequest): Promise<TransactionRecord> {
    const items = payload.items && payload.items.length > 0 ? payload.items : payload.productId && typeof payload.quantity === 'number'
      ? [{ productId: payload.productId, quantity: payload.quantity }]
      : [];

    if (items.length === 0) {
      throw new BadRequestException('No products were provided for this transaction');
    }

    const normalizedItems: TransactionItemRecord[] = [];

    for (const item of items) {
      const product = this.productsService.findProductById(item.productId);

      if (!product) {
        throw new BadRequestException(`Product not found: ${item.productId}`);
      }

      if (product.stock < item.quantity) {
        throw new BadRequestException(`Insufficient stock available for ${product.name}`);
      }

      const stockResult = this.productsService.reserveStock(item.productId, item.quantity);

      if (!stockResult.success) {
        throw new BadRequestException(stockResult.message);
      }

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

    void this.wompiService.registerPaymentAttempt({
      reference,
      amount: record.total,
      currency: 'COP',
      customer: payload.customer,
      transactionId: record.id,
    });

    return record;
  }

  getTransaction(transactionId: string): TransactionRecord | null {
    return this.transactions.get(transactionId) ?? null;
  }

  async pay(payload: PaymentExecutionRequest): Promise<{ success: boolean; message: string; transaction?: TransactionRecord }> {
    const transaction = this.transactions.get(payload.transactionId);

    if (!transaction) {
      return { success: false, message: 'Transaction not found' };
    }

    const itemsToProcess = payload.items && payload.items.length > 0
      ? payload.items
      : payload.productId && typeof payload.quantity === 'number'
        ? [{ productId: payload.productId, quantity: payload.quantity }]
        : transaction.items.map(({ productId, quantity }) => ({ productId, quantity }));

    const product = this.productsService.findProductById(itemsToProcess[0].productId);

    if (!product) {
      return { success: false, message: 'Product not found' };
    }

    const cleanedCard = payload.payment.cardNumber.replace(/\s+/g, '');
    const isApproved = /^4\d{15}$/.test(cleanedCard) || /^5\d{15}$/.test(cleanedCard);

    if (!isApproved) {
      for (const item of itemsToProcess) {
        this.productsService.releaseReservedStock(item.productId, item.quantity);
      }
      transaction.status = 'failed';
      transaction.providerStatus = 'rejected';
      transaction.errorMessage = 'Card rejected by payment provider';
      return { success: false, message: 'Payment rejected. Please verify the card details.', transaction };
    }

    const providerResult = await this.wompiService.authorizePayment({
      amount: transaction.total,
      reference: transaction.reference,
      currency: 'COP',
      customer: transaction.customer,
      payment: payload.payment,
    });

    if (!providerResult.success) {
      const providerMessage = providerResult.message ?? 'Payment failed';
      for (const item of itemsToProcess) {
        this.productsService.releaseReservedStock(item.productId, item.quantity);
      }
      transaction.status = 'failed';
      transaction.providerStatus = providerResult.providerStatus ?? 'rejected';
      transaction.errorMessage = providerMessage;
      return { success: false, message: providerMessage, transaction };
    }

    for (const item of itemsToProcess) {
      this.productsService.completeReservedStock(item.productId);
    }
    transaction.status = 'approved';
    transaction.providerStatus = providerResult.providerStatus ?? 'approved';

    return {
      success: true,
      message: 'Payment completed successfully',
      transaction,
    };
  }
}
