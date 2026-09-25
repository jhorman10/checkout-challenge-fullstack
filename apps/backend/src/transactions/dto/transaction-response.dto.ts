import { ApiProperty } from '@nestjs/swagger';

/** Transaction item in response. */
export class TransactionItemResponseDto {
  @ApiProperty({ description: 'Product ID', example: 'prod-aurora' })
  productId: string;

  @ApiProperty({ description: 'Quantity', example: 1 })
  quantity: number;

  @ApiProperty({ description: 'Amount in cents', example: 129900 })
  amount: number;
}

/** Transaction record response. */
export class TransactionResponseDto {
  @ApiProperty({ description: 'Transaction ID', example: 'txn-1234567890' })
  id: string;

  @ApiProperty({ description: 'Transaction reference', example: 'TXN-123456789-100' })
  reference: string;

  @ApiProperty({ description: 'Primary product ID', example: 'prod-aurora' })
  productId: string;

  @ApiProperty({ description: 'Total quantity', example: 1 })
  quantity: number;

  @ApiProperty({ description: 'Items amount in cents (without fees)', example: 129900 })
  amount: number;

  @ApiProperty({ description: 'Transaction items', type: [TransactionItemResponseDto] })
  items: TransactionItemResponseDto[];

  @ApiProperty({ description: 'Base fee in cents', example: 12000 })
  baseFee: number;

  @ApiProperty({ description: 'Delivery fee in cents', example: 9000 })
  deliveryFee: number;

  @ApiProperty({ description: 'Total amount in cents', example: 150900 })
  total: number;

  @ApiProperty({ description: 'Transaction status', enum: ['pending', 'approved', 'failed'], example: 'pending' })
  status: 'pending' | 'approved' | 'failed';

  @ApiProperty({ description: 'Customer information' })
  customer: {
    name: string;
    email: string;
    documentType: string;
    documentNumber: string;
  };

  @ApiProperty({ description: 'Delivery information' })
  delivery: {
    address: string;
    city: string;
    state: string;
    postalCode: string;
    phone: string;
  };

  @ApiProperty({ description: 'Provider status', required: false, example: 'APPROVED' })
  providerStatus?: string;

  @ApiProperty({ description: 'Error message if failed', required: false, example: 'Insufficient funds' })
  errorMessage?: string;

  @ApiProperty({ description: 'Creation timestamp', example: '2024-01-15T10:30:00.000Z' })
  createdAt: string;
}

/** Payment execution response. */
export class PaymentResponseDto {
  @ApiProperty({ description: 'Whether payment was successful', example: true })
  success: boolean;

  @ApiProperty({ description: 'Response message', example: 'Pago aprobado' })
  message: string;

  @ApiProperty({ description: 'Transaction details' })
  transaction: TransactionResponseDto;
}