import { z } from 'zod';

/**
 * Environment validation schema using Zod.
 *
 * Validates all required environment variables at startup and provides
 * type-safe access through ConfigService.
 */
export const envSchema = z.object({
  /** HTTP port the NestJS app listens on. */
  PORT: z.coerce.number().int().positive().default(3000),

  /** PostgreSQL connection string. Required. */
  DATABASE_URL: z.string().url().min(1),

  /** Whether to use SSL for database connection. */
  DB_SSL: z.coerce.boolean().default(false),

  /** Wompi environment — only sandbox is supported. */
  WOMPI_ENV: z.enum(['sandbox']).default('sandbox'),

  /** Wompi API key (private key). Must be non-empty in sandbox mode. */
  WOMPI_API_KEY: z.string().min(1, 'WOMPI_API_KEY is required in sandbox mode'),

  /** Wompi base URL for API calls. */
  WOMPI_BASE_URL: z.string().url().default('https://sandbox.wompi.co/v1'),

  /** CORS allowlist — comma-separated origins. */
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000'),

  /** Global rate limit — requests per window. */
  RATE_LIMIT_GLOBAL_MAX: z.coerce.number().int().positive().default(100),

  /** Global rate limit — window in minutes. */
  RATE_LIMIT_GLOBAL_WINDOW_MIN: z.coerce.number().int().positive().default(15),

  /** Payment endpoint rate limit — requests per window. */
  RATE_LIMIT_PAYMENT_MAX: z.coerce.number().int().positive().default(5),

  /** Payment endpoint rate limit — window in minutes. */
  RATE_LIMIT_PAYMENT_WINDOW_MIN: z.coerce.number().int().positive().default(15),

  /** Node environment. */
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

/** Inferred type from the schema. */
export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validates the raw environment object against the schema.
 *
 * @throws {z.ZodError} When validation fails — detailed errors for each invalid field.
 */
export function validateEnv(config: Record<string, unknown>): EnvConfig {
  return envSchema.parse(config);
}