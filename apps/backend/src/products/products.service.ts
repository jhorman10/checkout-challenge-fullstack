import { Injectable, Optional } from '@nestjs/common';
import { DomainError, domainError } from '../shared/errors.js';
import { Result, err, ok } from '../shared/result.js';
import { DatabaseService } from '../database/database.service.js';
import { ProductDto } from './dto/product.dto.js';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  reserved: boolean;
  reservedQuantity: number;
  currency: string;
  imageUrl: string;
}

const defaultProducts: Product[] = [
  {
    id: 'prod-aurora',
    name: 'Aurora Headphones',
    description: 'Wireless over-ear headphones with noise cancellation.',
    price: 129900,
    stock: 12,
    reserved: false,
    reservedQuantity: 0,
    currency: 'COP',
    imageUrl: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'prod-watch',
    name: 'Pulse Smartwatch',
    description: 'Fitness tracking and call notifications in one elegant design.',
    price: 249900,
    stock: 7,
    reserved: false,
    reservedQuantity: 0,
    currency: 'COP',
    imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'prod-speaker',
    name: 'Echo Mini Speaker',
    description: 'Portable speaker with deep bass and 12-hour battery life.',
    price: 89900,
    stock: 18,
    reserved: false,
    reservedQuantity: 0,
    currency: 'COP',
    imageUrl: 'https://images.unsplash.com/photo-1518444065439-e933c06ce9cd?auto=format&fit=crop&w=900&q=80',
  },
];

function toDto(product: Product): ProductDto {
  const dto = new ProductDto();
  dto.id = product.id;
  dto.name = product.name;
  dto.description = product.description;
  dto.price = product.price;
  dto.stock = product.stock;
  dto.reserved = product.reserved;
  dto.reservedQuantity = product.reservedQuantity;
  dto.currency = product.currency;
  dto.imageUrl = product.imageUrl;
  return dto;
}

@Injectable()
export class ProductsService {
  private readonly products: Product[];

  constructor(
    @Optional() private readonly databaseService?: DatabaseService,
    @Optional() initialProducts?: Product[],
  ) {
    this.products = (initialProducts ?? defaultProducts).map((product) => ({ ...product, reserved: !!product.reserved, reservedQuantity: product.reservedQuantity ?? 0 }));
  }

  listProducts(): ProductDto[] {
    return this.products.map((product) => toDto(product));
  }

  findProductById(productId: string): ProductDto | undefined {
    const product = this.products.find((product) => product.id === productId);
    return product ? toDto(product) : undefined;
  }

  reserveStock(productId: string, quantity: number): Result<ProductDto, DomainError> {
    const product = this.products.find((product) => product.id === productId);

    if (!product) {
      return err(domainError('PRODUCT_NOT_FOUND'));
    }

    if (product.stock < quantity) {
      return err(domainError('INSUFFICIENT_STOCK', `Insufficient stock for ${product.name}`));
    }

    product.stock -= quantity;
    product.reserved = true;
    product.reservedQuantity = quantity;

    return ok(toDto(product));
  }

  releaseReservedStock(productId: string, quantity: number): Result<ProductDto, DomainError> {
    const product = this.products.find((product) => product.id === productId);

    if (!product) {
      return err(domainError('PRODUCT_NOT_FOUND'));
    }

    product.stock += quantity;
    product.reserved = false;
    product.reservedQuantity = 0;

    return ok(toDto(product));
  }

  completeReservedStock(productId: string): Result<ProductDto, DomainError> {
    const product = this.products.find((product) => product.id === productId);

    if (!product) {
      return err(domainError('PRODUCT_NOT_FOUND'));
    }

    product.reserved = false;
    product.reservedQuantity = 0;

    return ok(toDto(product));
  }
}