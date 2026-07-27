import { ApiError } from '@/src/api/errors';

/** True for timeouts / unreachable server — safe to queue as offline drafts. */
export function isNetworkFailure(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.code === 'NETWORK_ERROR' || error.code === 'ECONNABORTED';
  }
  if (error instanceof TypeError) return true;
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('network') ||
      msg.includes('failed to fetch') ||
      msg.includes('network request failed')
    );
  }
  return false;
}
