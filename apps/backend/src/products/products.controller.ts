import { Controller, Get, Param } from '@nestjs/common';
import { ProductsService } from './products.service.js';

@Controller('api')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('products')
  async getProducts() {
    return this.productsService.listProducts();
  }

  @Get('products/:id')
  async getProduct(@Param('id') id: string) {
    const product = await this.productsService.findProductById(id);

    if (!product) {
      return { success: false, message: 'Product not found' };
    }

    return product;
  }
}
