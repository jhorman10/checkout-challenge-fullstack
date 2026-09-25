/**
 * Retry helper with exponential backoff and jitter.
 *
 * Retries only on HTTP 429 (Too Many Requests), 502 (Bad Gateway), 503
 * (Service Unavailable), and 504 (Gateway Timeout) — the status codes that
 * indicate a transient provider failure. Non-retryable errors (4xx other than
 * 429, network errors without a status) are thrown immediately.
 */

/** Default HTTP status codes that trigger a retry. */
const DEFAULT_RETRY_ON = [429, 502, 503, 504] as const;

export interface RetryOptions {
  /** Total number of attempts (first attempt + retries). Default 3. */
  attempts?: number;
  /** Base delay in milliseconds for the first backoff. Default 250. */
  delayMs?: number;
  /** HTTP status codes that should trigger a retry. Default [429, 502, 503, 504]. */
  retryOn?: number[];
  /** Whether to add random jitter to the backoff. Default true. */
  jitter?: boolean;
  /** Optional logger callback for retry diagnostics. */
  onRetry?: (error: unknown, attempt: number, delay: number) => void;
}

/** Error shape produced by axios on HTTP non-2xx responses. */
export interface HttpError extends Error {
  status?: number;
  code?: string;
  response?: {
    status: number;
    data?: unknown;
  };
}

const DEFAULT_OPTIONS: Required<
  Pick<RetryOptions, 'attempts' | 'delayMs' | 'retryOn' | 'jitter'>
> = {
  attempts: 3,
  delayMs: 250,
  retryOn: [...DEFAULT_RETRY_ON],
  jitter: true,
};

/**
 * Executes `fn` with retry-on-failure semantics.
 *
 * On the first failure whose status is in `retryOn`, waits an exponentially
 * increasing backoff (`delayMs * 2^(attempt-1)`), adds up to 50 % jitter, and
 * retries. After `attempts` total tries the last error is re-thrown.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const retryStatusCodes = new Set(opts.retryOn);

  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const status = extractHttpStatus(error);
      const shouldRetry =
        status !== undefined && retryStatusCodes.has(status);

      if (!shouldRetry || attempt === opts.attempts) {
        throw error;
      }

      const backoff = opts.delayMs * Math.pow(2, attempt - 1);
      const jitterAmount = opts.jitter ? Math.random() * (backoff * 0.5) : 0;
      const delay = backoff + jitterAmount;

      opts.onRetry?.(error, attempt, delay);

      await sleep(delay);
    }
  }

  // Unreachable — the loop always returns or throws — but TS needs it.
  throw lastError;
}

/** Extracts the HTTP status code from an axios or generic error, if present. */
function extractHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;

  const httpError = error as HttpError;
  return httpError.status ?? httpError.response?.status;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { DEFAULT_RETRY_ON };
