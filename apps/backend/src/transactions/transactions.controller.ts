import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { TransactionService, type CreateTransactionRequest, type PaymentExecutionRequest } from './transaction.service.js';

@Controller('api')
export class TransactionsController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post('transactions')
  async createTransaction(@Body() payload: CreateTransactionRequest) {
    return this.transactionService.createPendingTransaction(payload);
  }

  @Get('transactions/:id')
  getTransaction(@Param('id') id: string) {
    return this.transactionService.getTransaction(id);
  }

  @Post('transactions/:id/pay')
  async payTransaction(@Param('id') id: string, @Body() payload: Omit<PaymentExecutionRequest, 'transactionId'>) {
    return this.transactionService.pay({
      transactionId: id,
      ...payload,
    });
  }
}
