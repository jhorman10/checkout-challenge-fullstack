#!/usr/bin/env node
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from '../app.module.js';
import { writeFileSync, mkdirSync, copyFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function generateOpenApi() {
  // Set required env vars for config validation
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/checkout_db';
  process.env.WOMPI_API_KEY = process.env.WOMPI_API_KEY ?? 'test';
  process.env.WOMPI_ENV = process.env.WOMPI_ENV ?? 'sandbox';
  process.env.WOMPI_BASE_URL = process.env.WOMPI_BASE_URL ?? 'https://api-sandbox.co.uat.wompi.dev/v1';
  process.env.CORS_ORIGINS = process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:3000';
  process.env.PORT = process.env.PORT ?? '3000';

  const app = await NestFactory.create(AppModule);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Wompi Checkout API')
    .setDescription('REST API for Wompi payment checkout flow')
    .setVersion('1.0.0')
    .addTag('Products', 'Product catalog endpoints')
    .addTag('Transactions', 'Transaction and payment endpoints')
    .addTag('Health', 'Health check endpoint')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  const projectRoot = resolve(__dirname, '..', '..');
  const outputPath = resolve(projectRoot, 'openapi.json');
  const distOutputPath = resolve(__dirname, 'openapi.json');
  
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(distOutputPath, JSON.stringify(document, null, 2));
  copyFileSync(distOutputPath, outputPath);
  console.log(`OpenAPI spec written to ${outputPath}`);

  await app.close();
}

generateOpenApi().catch((error) => {
  console.error('Failed to generate OpenAPI spec:', error);
  process.exit(1);
});