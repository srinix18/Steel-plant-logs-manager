import assert from 'node:assert/strict';

import { ApiError, getErrorMessage } from '../src/api/errors.ts';

assert.equal(
  getErrorMessage(new ApiError('x', { code: 'ECONNABORTED' })),
  'Request timed out. Check your connection and try again.'
);
assert.equal(
  getErrorMessage(new ApiError('x', { code: 'NETWORK_ERROR' })),
  'Cannot reach the server. Check EXPO_PUBLIC_API_URL and that the API is running.'
);
assert.equal(
  getErrorMessage(new ApiError('fail', { detail: 'Invalid credentials' })),
  'Invalid credentials'
);
assert.equal(
  getErrorMessage(new ApiError('fail', { detail: [{ msg: 'a' }, { msg: 'b' }] })),
  'a, b'
);
assert.equal(
  getErrorMessage(new ApiError('fail', { status: 503 })),
  'Server is starting or the database is unavailable.'
);
assert.equal(getErrorMessage(new Error('boom')), 'boom');
assert.equal(getErrorMessage('nope'), 'An unexpected error occurred');

console.log('api error mapping: ok');
