import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, ValidateNested, IsArray, ArrayMinSize, Min, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';

/** Customer information for transaction. */
export class TransactionCustomerDto {
  @ApiProperty({ description: 'Customer full name', example: 'Juan Pérez' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Customer email', example: 'juan@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Document type', example: 'CC', enum: ['CC', 'CE', 'NIT', 'PP'] })
  @IsString()
  documentType: 'CC' | 'CE' | 'NIT' | 'PP';

  @ApiProperty({ description: 'Document number', example: '1234567890' })
  @IsString()
  documentNumber: string;
}

/** Delivery information for transaction. */
export class TransactionDeliveryDto {
  @ApiProperty({ description: 'Delivery address', example: 'Calle 123 #45-67' })
  @IsString()
  address: string;

  @ApiProperty({ description: 'City', example: 'Bogotá' })
  @IsString()
  city: string;

  @ApiProperty({ description: 'State/Department', example: 'Cundinamarca' })
  @IsString()
  state: string;

  @ApiProperty({ description: 'Postal code', example: '110111' })
  @IsString()
  postalCode: string;

  @ApiProperty({ description: 'Phone number', example: '+573001234567' })
  @IsString()
  phone: string;
}

/** Payment card information. */
export class PaymentCardDto {
  @ApiProperty({ description: 'Card number', example: '4242424242424242' })
  @IsString()
  cardNumber: string;

  @ApiProperty({ description: 'Cardholder name', example: 'Juan Pérez' })
  @IsString()
  holderName: string;

  @ApiProperty({ description: 'Expiration month (MM)', example: '12' })
  @IsString()
  expMonth: string;

  @ApiProperty({ description: 'Expiration year (YYYY)', example: '2026' })
  @IsString()
  expYear: string;

  @ApiProperty({ description: 'CVC', example: '123' })
  @IsString()
  cvv: string;
}

/** Individual item in a transaction. */
export class TransactionItemDto {
  @ApiProperty({ description: 'Product ID', example: 'prod-aurora' })
  @IsString()
  productId: string;

  @ApiProperty({ description: 'Quantity', example: 1, minimum: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;
}

/** DTO for creating a new transaction. */
export class CreateTransactionDto {
  @ApiProperty({ description: 'Product ID (legacy single item)', required: false, example: 'prod-aurora' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiProperty({ description: 'Quantity (legacy single item)', required: false, example: 1, minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @ApiProperty({ description: 'Items (preferred for multiple products)', type: [TransactionItemDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransactionItemDto)
  @ArrayMinSize(1)
  items?: TransactionItemDto[];

  @ApiProperty({ description: 'Customer information' })
  @ValidateNested()
  @Type(() => TransactionCustomerDto)
  customer: TransactionCustomerDto;

  @ApiProperty({ description: 'Delivery information' })
  @ValidateNested()
  @Type(() => TransactionDeliveryDto)
  delivery: TransactionDeliveryDto;

  @ApiProperty({ description: 'Payment card information' })
  @ValidateNested()
  @Type(() => PaymentCardDto)
  payment: PaymentCardDto;
}

/** DTO for executing payment on an existing transaction. */
export class PayTransactionDto {
  @ApiProperty({ description: 'Product ID (legacy single item)', required: false, example: 'prod-aurora' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiProperty({ description: 'Quantity (legacy single item)', required: false, example: 1, minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @ApiProperty({ description: 'Items (preferred for multiple products)', type: [TransactionItemDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransactionItemDto)
  @ArrayMinSize(1)
  items?: TransactionItemDto[];

  @ApiProperty({ description: 'Customer information' })
  @ValidateNested()
  @Type(() => TransactionCustomerDto)
  customer: TransactionCustomerDto;

  @ApiProperty({ description: 'Delivery information' })
  @ValidateNested()
  @Type(() => TransactionDeliveryDto)
  delivery: TransactionDeliveryDto;

  @ApiProperty({ description: 'Payment card information' })
  @ValidateNested()
  @Type(() => PaymentCardDto)
  payment: PaymentCardDto;
}