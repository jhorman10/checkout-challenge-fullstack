import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import { ProductsController } from './products/products.controller.js';
import { ProductsService } from './products/products.service.js';
import { TransactionService } from './transactions/transaction.service.js';
import { TransactionsController } from './transactions/transactions.controller.js';
import { WompiModule } from './wompi/wompi.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, WompiModule],
  controllers: [AppController, ProductsController, TransactionsController],
  providers: [AppService, ProductsService, TransactionService],
})
export class AppModule {}
