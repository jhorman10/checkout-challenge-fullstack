import { ApiProperty } from '@nestjs/swagger';

/** Product entity for API responses. */
export class ProductDto {
  @ApiProperty({ description: 'Product ID', example: 'prod-aurora' })
  id: string;

  @ApiProperty({ description: 'Product name', example: 'Aurora Headphones' })
  name: string;

  @ApiProperty({ description: 'Product description', example: 'Wireless over-ear headphones with noise cancellation.' })
  description: string;

  @ApiProperty({ description: 'Product price in cents', example: 129900 })
  price: number;

  @ApiProperty({ description: 'Available stock quantity', example: 12 })
  stock: number;

  @ApiProperty({ description: 'Whether the product has reserved stock', example: false })
  reserved: boolean;

  @ApiProperty({ description: 'Quantity of reserved stock', example: 0 })
  reservedQuantity: number;

  @ApiProperty({ description: 'Currency code', example: 'COP' })
  currency: string;

  @ApiProperty({ description: 'Product image URL', example: 'https://example.com/image.jpg' })
  imageUrl: string;
}