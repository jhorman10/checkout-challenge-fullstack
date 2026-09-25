import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_RETRY_ON, withRetry } from './retry.js';

describe('withRetry', () => {
  it('returns the resolved value on the first successful attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await withRetry(fn, { attempts: 3, jitter: false, delayMs: 0 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it.each(DEFAULT_RETRY_ON)(
    'retries on HTTP %i and succeeds',
    async (status) => {
      const httpError = Object.assign(new Error('transient'), { status });
      const fn = vi
        .fn()
        .mockRejectedValueOnce(httpError)
        .mockResolvedValueOnce('recovered');

      const result = await withRetry(fn, {
        attempts: 3,
        delayMs: 1,
        jitter: false,
      });

      expect(result).toBe('recovered');
      expect(fn).toHaveBeenCalledTimes(2);
    },
  );

  it('does NOT retry on non-retryable status codes (e.g. 400)', async () => {
    const httpError = Object.assign(new Error('bad request'), { status: 400 });
    const fn = vi.fn().mockRejectedValueOnce(httpError);

    await expect(
      withRetry(fn, { attempts: 3, delayMs: 1, jitter: false }),
    ).rejects.toThrow('bad request');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on errors without a status code', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('network'));

    await expect(
      withRetry(fn, { attempts: 3, delayMs: 1, jitter: false }),
    ).rejects.toThrow('network');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('respects the attempts limit and re-throws the last error', async () => {
    const httpError = Object.assign(new Error('persistent 503'), {
      status: 503,
    });
    const fn = vi.fn().mockRejectedValue(httpError);

    await expect(
      withRetry(fn, { attempts: 3, delayMs: 1, jitter: false }),
    ).rejects.toThrow('persistent 503');

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('calls onRetry callback between attempts', async () => {
    const httpError = Object.assign(new Error('503'), { status: 503 });
    const fn = vi
      .fn()
      .mockRejectedValueOnce(httpError)
      .mockResolvedValueOnce('ok');
    const onRetry = vi.fn();

    await withRetry(fn, {
      attempts: 3,
      delayMs: 1,
      jitter: false,
      onRetry,
    });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(httpError, 1, expect.any(Number));
  });

  it('adds jitter to the backoff delay', async () => {
    const httpError = Object.assign(new Error('503'), { status: 503 });
    const fn = vi
      .fn()
      .mockRejectedValueOnce(httpError)
      .mockResolvedValueOnce('ok');
    const onRetry = vi.fn();

    // With jitter enabled the delay should be at least base (backoff)
    await withRetry(fn, {
      attempts: 3,
      delayMs: 100,
      jitter: true,
      onRetry,
    });

    expect(onRetry).toHaveBeenCalledTimes(1);
    const [error, attempt, delay] = onRetry.mock.calls[0]!;
    expect(error).toBe(httpError);
    expect(attempt).toBe(1);
    // backoff = 100 * 2^0 = 100, jitter adds 0..50, so delay is 100..150
    expect(delay).toBeGreaterThanOrEqual(100);
    expect(delay).toBeLessThanOrEqual(150);
  });

  it('supports custom retryOn status codes', async () => {
    const httpError = Object.assign(new Error('418'), { status: 418 });
    const fn = vi
      .fn()
      .mockRejectedValueOnce(httpError)
      .mockResolvedValueOnce('teapot-ok');

    const result = await withRetry(fn, {
      attempts: 3,
      delayMs: 1,
      jitter: false,
      retryOn: [418],
    });

    expect(result).toBe('teapot-ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('extracts status from axios-style response.status', async () => {
    const axiosError = new Error('axios error');
    (axiosError as any).response = { status: 502 };
    const fn = vi
      .fn()
      .mockRejectedValueOnce(axiosError)
      .mockResolvedValueOnce('axios-ok');

    const result = await withRetry(fn, {
      attempts: 3,
      delayMs: 1,
      jitter: false,
    });

    expect(result).toBe('axios-ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
