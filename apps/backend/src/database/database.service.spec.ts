import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigService } from '@nestjs/config';

// Create mock pool object
const mockPool = {
  connect: vi.fn(),
  query: vi.fn(),
  end: vi.fn(),
};

// Track Pool constructor calls
const poolCalls: any[] = [];

// Mock the pg module - class must be defined inside the factory
vi.mock('pg', () => {
  class MockPool {
    constructor(...args: any[]) {
      poolCalls.push(args);
      Object.assign(this, mockPool);
    }
  }
  return { Pool: MockPool };
});

vi.mock('@nestjs/config');

import { DatabaseService } from './database.service.js';

describe('DatabaseService', () => {
  let service: DatabaseService;
  let mockConfigService: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    poolCalls.length = 0;
    mockPool.connect.mockReset();
    mockPool.query.mockReset();
    mockPool.end.mockReset();

    mockConfigService = {
      get: vi.fn((key: string, defaultValue?: string) => {
        if (key === 'DATABASE_URL') return 'postgresql://postgres:postgres@localhost:5432/checkout_db';
        if (key === 'DB_SSL') return 'false';
        return defaultValue;
      }),
    };

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    service = new DatabaseService(mockConfigService);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('constructor', () => {
    it('creates pool with correct configuration', () => {
      expect(poolCalls).toHaveLength(1);
      expect(poolCalls[0]).toEqual([{
        connectionString: 'postgresql://postgres:postgres@localhost:5432/checkout_db',
        max: 20,
        ssl: false,
      }]);
    });

    it('enables SSL when DB_SSL is true', () => {
      poolCalls.length = 0;
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'DATABASE_URL') return 'postgresql://postgres:postgres@localhost:5432/checkout_db';
        if (key === 'DB_SSL') return 'true';
        return undefined;
      });

      new DatabaseService(mockConfigService);

      expect(poolCalls).toHaveLength(1);
      expect(poolCalls[0]).toEqual(expect.arrayContaining([
        expect.objectContaining({
          ssl: { rejectUnauthorized: false },
        }),
      ]));
    });

    it('uses default connection string when not configured', () => {
      poolCalls.length = 0;
      mockConfigService.get.mockReturnValue(undefined);

      new DatabaseService(mockConfigService);

      expect(poolCalls).toHaveLength(1);
      expect(poolCalls[0]).toEqual(expect.arrayContaining([
        expect.objectContaining({
          connectionString: 'postgresql://postgres:postgres@localhost:5432/checkout_db',
        }),
      ]));
    });
  });

  describe('onModuleInit', () => {
    it('connects and tests database connection successfully', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
        release: vi.fn(),
      };

      mockPool.connect.mockResolvedValue(mockClient);

      await service.onModuleInit();

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('SELECT 1');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('handles connection error gracefully without throwing', async () => {
      const error = new Error('Connection refused');
      mockPool.connect.mockRejectedValue(error);

      // Should not throw - error is caught and logged internally
      await expect(service.onModuleInit()).resolves.not.toThrow();
    });

    it('handles error without stack trace gracefully without throwing', async () => {
      const error = { message: 'Connection refused' };
      mockPool.connect.mockRejectedValue(error);

      // Should not throw - error is caught and logged internally
      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  describe('getPool', () => {
    it('returns the pool instance', () => {
      const pool = service.getPool();
      expect(pool).toEqual(mockPool);
    });
  });

  describe('query', () => {
    it('delegates to pool query', async () => {
      const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
      mockPool.query.mockResolvedValue(mockResult);

      const result = await service.query('SELECT * FROM products', [1]);

      expect(result).toEqual(mockResult);
      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM products', [1]);
    });

    it('handles query without params', async () => {
      const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
      mockPool.query.mockResolvedValue(mockResult);

      const result = await service.query('SELECT * FROM products');

      expect(result).toEqual(mockResult);
      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM products', undefined);
    });
  });

  describe('close', () => {
    it('closes the pool', async () => {
      mockPool.end.mockResolvedValue(undefined);

      await service.close();

      expect(mockPool.end).toHaveBeenCalled();
    });
  });
});