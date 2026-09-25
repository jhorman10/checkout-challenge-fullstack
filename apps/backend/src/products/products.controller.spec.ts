import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';
import { ProductDto } from './dto/product.dto.js';

describe('ProductsController', () => {
  let controller: ProductsController;
  let mockProductsService: any;

  const mockProducts: ProductDto[] = [
    {
      id: 'aurora-headphones',
      name: 'Aurora Headphones',
      description: 'Wireless over-ear headphones with noise cancellation.',
      price: 129900,
      stock: 9,
      currency: 'COP',
      imageUrl: 'https://example.com/aurora.png',
    },
    {
      id: 'pulse-smartwatch',
      name: 'Pulse Smartwatch',
      description: 'Fitness tracking and call notifications.',
      price: 249900,
      stock: 5,
      currency: 'COP',
      imageUrl: 'https://example.com/watch.png',
    },
  ];

  beforeEach(async () => {
    mockProductsService = {
      listProducts: vi.fn(),
      findProductById: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        {
          provide: ProductsService,
          useValue: mockProductsService,
        },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
    vi.clearAllMocks();
  });

  describe('getProducts', () => {
    it('returns list of products', async () => {
      mockProductsService.listProducts.mockReturnValue(mockProducts);

      const result = await controller.getProducts();

      expect(result).toEqual(mockProducts);
      expect(mockProductsService.listProducts).toHaveBeenCalled();
    });

    it('returns empty array when no products', async () => {
      mockProductsService.listProducts.mockReturnValue([]);

      const result = await controller.getProducts();

      expect(result).toEqual([]);
    });
  });

  describe('getProduct', () => {
    it('returns product when found', async () => {
      const product = mockProducts[0];
      mockProductsService.findProductById.mockReturnValue(product);

      const result = await controller.getProduct('aurora-headphones');

      expect(result).toEqual(product);
      expect(mockProductsService.findProductById).toHaveBeenCalledWith('aurora-headphones');
    });

    it('throws NotFoundException when product not found', async () => {
      mockProductsService.findProductById.mockReturnValue(undefined);

      await expect(controller.getProduct('non-existent')).rejects.toThrow(NotFoundException);
      await expect(controller.getProduct('non-existent')).rejects.toMatchObject({
        message: 'Product not found',
      });
    });

    it('throws NotFoundException when product is null', async () => {
      mockProductsService.findProductById.mockReturnValue(null);

      await expect(controller.getProduct('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});