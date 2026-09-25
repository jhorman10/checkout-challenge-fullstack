import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { validateEnv } from './config/env.validation.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import { ProductsController } from './products/products.controller.js';
import { ProductsService } from './products/products.service.js';
import { TransactionService } from './transactions/transaction.service.js';
import { TransactionsController } from './transactions/transactions.controller.js';
import { WompiModule } from './wompi/wompi.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 15 * 60 * 1000, // 15 minutes
        limit: 100, // 100 requests per window
      },
      {
        name: 'payment',
        ttl: 15 * 60 * 1000, // 15 minutes
        limit: 5, // 5 requests per window
      },
    ]),
    DatabaseModule,
    WompiModule,
  ],
  controllers: [AppController, ProductsController, TransactionsController],
  providers: [
    AppService,
    ProductsService,
    TransactionService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}