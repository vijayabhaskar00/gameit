import { describe, expect, it, vi } from 'vitest';
import { ApiError, withRetry } from '../src/lib/api';

const NO_WAIT = [0, 0, 0];

describe('withRetry', () => {
  it('retries a lost connection until it works', async () => {
    const call = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new ApiError('server_error'))
      .mockResolvedValue('ok');
    await expect(withRetry(call, NO_WAIT)).resolves.toBe('ok');
    expect(call).toHaveBeenCalledTimes(3);
  });

  it('stops at once on a final answer from the server', async () => {
    const call = vi.fn().mockRejectedValue(new ApiError('round_not_started'));
    await expect(withRetry(call, NO_WAIT)).rejects.toThrow('round_not_started');
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('gives up after the last delay', async () => {
    const call = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(withRetry(call, NO_WAIT)).rejects.toThrow('Failed to fetch');
    expect(call).toHaveBeenCalledTimes(4);
  });
});
