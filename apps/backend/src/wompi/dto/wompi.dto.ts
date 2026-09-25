import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

/** Supported currencies for Wompi transactions. */
export enum WompiCurrency {
  COP = 'COP',
}

/** Customer information for Wompi transaction. */
export class WompiCustomerDto {
  @ApiProperty({ description: 'Customer full name', example: 'Juan Pérez' })
  @IsString()
  fullName: string;

  @ApiProperty({ description: 'Customer email', example: 'juan@example.com' })
  @IsString()
  email: string;

  @ApiProperty({ description: 'Document number', example: '1234567890' })
  @IsString()
  legalId: string;

  @ApiProperty({ description: 'Document type', example: 'CC', enum: ['CC', 'CE', 'NIT', 'PP'] })
  @IsString()
  @IsEnum(['CC', 'CE', 'NIT', 'PP'])
  legalIdType: 'CC' | 'CE' | 'NIT' | 'PP';
}

/** Card information for Wompi payment. */
export class WompiCardDto {
  @ApiProperty({ description: 'Card number (will be tokenized)', example: '4242424242424242' })
  @IsString()
  number: string;

  @ApiProperty({ description: 'Card expiration month (MM)', example: '12' })
  @IsString()
  expMonth: string;

  @ApiProperty({ description: 'Card expiration year (YYYY)', example: '2026' })
  @IsString()
  expYear: string;

  @ApiProperty({ description: 'Card CVC', example: '123' })
  @IsString()
  cvc: string;

  @ApiProperty({ description: 'Cardholder name', example: 'Juan Pérez' })
  @IsString()
  holder: string;
}

/** Request to create a transaction in Wompi. */
export class WompiTransactionRequest {
  @ApiProperty({ description: 'Amount in cents', example: 1500000 })
  @IsNumber()
  amountInCents: number;

  @ApiProperty({ description: 'Currency', enum: WompiCurrency, example: WompiCurrency.COP })
  @IsEnum(WompiCurrency)
  currency: WompiCurrency;

  @ApiProperty({ description: 'Unique transaction reference', example: 'TXN-123456789-100' })
  @IsString()
  reference: string;

  @ApiProperty({ description: 'Customer information' })
  @ValidateNested()
  @Type(() => WompiCustomerDto)
  customerEmail: string;

  @ApiProperty({ description: 'Customer data' })
  @ValidateNested()
  @Type(() => WompiCustomerDto)
  customerData: {
    fullName: string;
    legalId: string;
    legalIdType: 'CC' | 'CE' | 'NIT' | 'PP';
  };

  @ApiProperty({ description: 'Payment method (card token or card object)', required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => WompiCardDto)
  paymentMethod?: {
    type: 'CARD';
    token: string;
    installments: number;
  } | {
    type: 'CARD';
    card: WompiCardDto;
    installments: number;
  };

  @ApiProperty({ description: 'Idempotency key for duplicate prevention', required: false })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

/** Wompi transaction status enum. */
export enum WompiTransactionStatus {
  APPROVED = 'APPROVED',
  DECLINED = 'DECLINED',
  PENDING = 'PENDING',
  ERROR = 'ERROR',
  VOIDED = 'VOIDED',
}

/** Response from Wompi transaction API. */
export class WompiTransactionResponse {
  @ApiProperty({ description: 'Transaction ID in Wompi', example: 'txn_abc123' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Transaction status', enum: WompiTransactionStatus })
  @IsEnum(WompiTransactionStatus)
  status: WompiTransactionStatus;

  @ApiProperty({ description: 'Amount in cents', example: 1500000 })
  @IsNumber()
  amountInCents: number;

  @ApiProperty({ description: 'Currency', enum: WompiCurrency })
  @IsEnum(WompiCurrency)
  currency: WompiCurrency;

  @ApiProperty({ description: 'Transaction reference', example: 'TXN-123456789-100' })
  @IsString()
  reference: string;

  @ApiProperty({ description: 'Customer email', example: 'juan@example.com' })
  @IsString()
  customerEmail: string;

  @ApiProperty({ description: 'Payment method details', required: false })
  @IsOptional()
  paymentMethod?: {
    type: string;
    extra: {
      bin: string;
      lastFour: string;
      expMonth: string;
      expYear: string;
      cardHolder: string;
      brand: string;
    };
  };

  @ApiProperty({ description: 'Status message', required: false })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({ description: 'Created at timestamp', example: '2024-01-15T10:30:00.000Z' })
  @IsString()
  createdAt: string;

  @ApiProperty({ description: 'Finalized at timestamp', required: false })
  @IsOptional()
  @IsString()
  finalizedAt?: string;
}