import { Injectable, Optional } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

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

@Injectable()
export class ProductsService {
  private readonly products: Product[];

  constructor(
    @Optional() private readonly databaseService?: DatabaseService,
    @Optional() initialProducts?: Product[],
  ) {
    this.products = (initialProducts ?? defaultProducts).map((product) => ({ ...product, reserved: !!product.reserved, reservedQuantity: product.reservedQuantity ?? 0 }));
  }

  listProducts(): Product[] {
    return this.products.map((product) => ({ ...product }));
  }

  findProductById(productId: string): Product | undefined {
    return this.products.find((product) => product.id === productId);
  }

  reserveStock(productId: string, quantity: number): { success: boolean; message: string; product?: Product } {
    const product = this.findProductById(productId);

    if (!product) {
      return { success: false, message: 'Product not found' };
    }

    if (product.stock < quantity) {
      return { success: false, message: 'Insufficient stock available' };
    }

    product.stock -= quantity;
    product.reserved = true;
    product.reservedQuantity = quantity;

    return {
      success: true,
      message: 'Stock reserved while payment is being processed',
      product: { ...product },
    };
  }

  releaseReservedStock(productId: string, quantity: number): { success: boolean; message: string; product?: Product } {
    const product = this.findProductById(productId);

    if (!product) {
      return { success: false, message: 'Product not found' };
    }

    product.stock += quantity;
    product.reserved = false;
    product.reservedQuantity = 0;

    return {
      success: true,
      message: 'Reserved stock released',
      product: { ...product },
    };
  }

  completeReservedStock(productId: string): { success: boolean; message: string; product?: Product } {
    const product = this.findProductById(productId);

    if (!product) {
      return { success: false, message: 'Product not found' };
    }

    product.reserved = false;
    product.reservedQuantity = 0;

    return {
      success: true,
      message: 'Reservation cleared after payment confirmation',
      product: { ...product },
    };
  }
}
