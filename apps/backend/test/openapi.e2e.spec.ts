import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { AppModule } from '../src/app.module.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('OpenAPI Document Drift Test', () => {
  let app: INestApplication;
  let generatedDoc: any;
  let committedDoc: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    const swaggerConfig = new DocumentBuilder()
      .setTitle('Wompi Checkout API')
      .setDescription('REST API for Wompi payment checkout flow')
      .setVersion('1.0.0')
      .addTag('Products', 'Product catalog endpoints')
      .addTag('Transactions', 'Transaction and payment endpoints')
      .addTag('Health', 'Health check endpoint')
      .addBearerAuth()
      .build();

    generatedDoc = SwaggerModule.createDocument(app, swaggerConfig);

    // Load committed OpenAPI spec
    const committedPath = resolve(__dirname, '../openapi.json');
    committedDoc = JSON.parse(readFileSync(committedPath, 'utf-8'));

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should have the same paths as committed spec', () => {
    const generatedPaths = Object.keys(generatedDoc.paths).sort();
    const committedPaths = Object.keys(committedDoc.paths).sort();

    expect(generatedPaths).toEqual(committedPaths);
  });

  it('should have the same operations for each path', () => {
    for (const path of Object.keys(generatedDoc.paths)) {
      const generatedMethods = Object.keys(generatedDoc.paths[path]).sort();
      const committedMethods = Object.keys(committedDoc.paths[path]).sort();

      expect(generatedMethods).toEqual(committedMethods);
    }
  });

  it('should have the same components/schemas', () => {
    const generatedSchemas = Object.keys(generatedDoc.components?.schemas ?? {}).sort();
    const committedSchemas = Object.keys(committedDoc.components?.schemas ?? {}).sort();

    expect(generatedSchemas).toEqual(committedSchemas);
  });

  it('should have all 5 expected routes', () => {
    const expectedRoutes = [
      { path: '/', method: 'get' },
      { path: '/health', method: 'get' },
      { path: '/api/products', method: 'get' },
      { path: '/api/products/{id}', method: 'get' },
      { path: '/api/transactions', method: 'post' },
      { path: '/api/transactions/{id}', method: 'get' },
      { path: '/api/transactions/{id}/pay', method: 'post' },
    ];

    for (const { path, method } of expectedRoutes) {
      expect(generatedDoc.paths[path]).toBeDefined();
      expect(generatedDoc.paths[path][method]).toBeDefined();
    }
  });

  it('should have correct info', () => {
    expect(generatedDoc.info.title).toBe('Wompi Checkout API');
    expect(generatedDoc.info.version).toBe('1.0.0');
  });

  it('should have all required tags', () => {
    const tagNames = generatedDoc.tags?.map((t: any) => t.name) ?? [];
    expect(tagNames).toContain('Products');
    expect(tagNames).toContain('Transactions');
    expect(tagNames).toContain('Health');
  });
});