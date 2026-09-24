import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;

  constructor(private readonly configService: ConfigService) {
    const connectionString =
      this.configService.get<string>('DATABASE_URL') ??
      'postgresql://postgres:postgres@localhost:5432/wompi_checkout';

    this.pool = new Pool({
      connectionString,
      max: 20,
      ssl:
        this.configService.get<string>('DB_SSL') === 'true'
          ? { rejectUnauthorized: false }
          : false,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      this.logger.log('PostgreSQL connection successful');
    } catch (error) {
      this.logger.error(
        'PostgreSQL connection failed. Start the database with: docker compose up -d postgres',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  getPool(): Pool {
    return this.pool;
  }

  async query(text: string, params?: unknown[]) {
    return this.pool.query(text, params);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
