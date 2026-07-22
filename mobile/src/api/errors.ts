export class ApiError extends Error {
  status?: number;
  code?: string;
  detail?: unknown;

  constructor(message: string, opts?: { status?: number; code?: string; detail?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.status = opts?.status;
    this.code = opts?.code;
    this.detail = opts?.detail;
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'ECONNABORTED') {
      return 'Request timed out. Check your connection and try again.';
    }
    if (error.code === 'NETWORK_ERROR') {
      return 'Cannot reach the server. Check EXPO_PUBLIC_API_URL and that the API is running.';
    }
    if (typeof error.detail === 'string') return error.detail;
    if (Array.isArray(error.detail)) {
      return error.detail.map((d: { msg?: string }) => d.msg ?? String(d)).join(', ');
    }
    if (error.status === 503) {
      return 'Server is starting or the database is unavailable.';
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
}
