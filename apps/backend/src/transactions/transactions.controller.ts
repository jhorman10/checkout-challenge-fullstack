import {
  Body,
  Controller,
  Get,
  HttpException,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { toHttpStatus } from '../shared/errors.js';
import { isErr } from '../shared/result.js';
import { TransactionService, CreateTransactionRequest, PaymentExecutionRequest } from './transaction.service.js';
import { CreateTransactionDto, PayTransactionDto } from './dto/transaction.dto.js';
import { TransactionResponseDto, PaymentResponseDto } from './dto/transaction-response.dto.js';

@ApiTags('Transactions')
@Controller('api')
@UseGuards(ThrottlerGuard)
export class TransactionsController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post('transactions')
  @Throttle({ payment: { limit: 5, ttl: 900000 } }) // 5 requests per 15 minutes
  @ApiOperation({ summary: 'Create a new pending transaction' })
  @ApiBody({ type: CreateTransactionDto })
  @ApiResponse({ status: 201, description: 'Transaction created successfully', type: TransactionResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input or insufficient stock' })
  @ApiResponse({ status: 409, description: 'Duplicate operation' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async createTransaction(@Body() payload: CreateTransactionDto) {
    const request: CreateTransactionRequest = {
      productId: payload.productId,
      quantity: payload.quantity,
      items: payload.items,
      customer: payload.customer,
      delivery: payload.delivery,
      payment: payload.payment,
    };

    const result = await this.transactionService.createPendingTransaction(request);

    if (isErr(result)) {
      const status = toHttpStatus(result.error.code);
      throw new HttpException(
        { message: result.error.message, code: result.error.code },
        status,
      );
    }

    return result.value;
  }

  @Get('transactions/:id')
  @ApiOperation({ summary: 'Get transaction by ID' })
  @ApiParam({ name: 'id', description: 'Transaction ID', example: 'txn-1234567890' })
  @ApiResponse({ status: 200, description: 'Transaction found', type: TransactionResponseDto })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  getTransaction(@Param('id') id: string) {
    const transaction = this.transactionService.getTransaction(id);

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
  }

  @Post('transactions/:id/pay')
  @Throttle({ payment: { limit: 5, ttl: 900000 } }) // 5 requests per 15 minutes
  @ApiOperation({ summary: 'Execute payment for a transaction' })
  @ApiParam({ name: 'id', description: 'Transaction ID', example: 'txn-1234567890' })
  @ApiBody({ type: PayTransactionDto })
  @ApiResponse({ status: 201, description: 'Payment approved', type: PaymentResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 402, description: 'Payment declined' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  @ApiResponse({ status: 409, description: 'Duplicate operation' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  @ApiResponse({ status: 502, description: 'Payment provider error' })
  async payTransaction(@Param('id') id: string, @Body() payload: PayTransactionDto) {
    const request: PaymentExecutionRequest = {
      transactionId: id,
      productId: payload.productId,
      quantity: payload.quantity,
      items: payload.items,
      customer: payload.customer,
      delivery: payload.delivery,
      payment: payload.payment,
    };

    const result = await this.transactionService.pay(request);

    if (isErr(result)) {
      const status = toHttpStatus(result.error.code);
      throw new HttpException(
        { message: result.error.message, code: result.error.code },
        status,
      );
    }

    return {
      success: true,
      message: result.value.status === 'approved' ? 'Pago aprobado' : 'Pago pendiente',
      transaction: result.value,
    };
  }
}