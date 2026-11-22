import { describe, expect, it } from 'vitest';
import { ApiClientError } from '../services/apiClient';
import { API_ROUTES, MAX_TEXT_LENGTH } from '../config/apiConfig';

describe('apiConfig & ApiClientError', () => {
  it('defines centralized API endpoints and text limit', () => {
    expect(API_ROUTES.HEALTH).toBe('/api/health');
    expect(API_ROUTES.TRANSLATE).toBe('/api/translate');
    expect(API_ROUTES.TRAVEL_REVIEWS).toBe('/api/travel/reviews');
    expect(API_ROUTES.TRAVEL_INQUIRY).toBe('/api/travel/inquiry');
    expect(API_ROUTES.TRAVEL_DESTINATION).toBe('/api/travel/destination');
    expect(MAX_TEXT_LENGTH).toBe(5000);
  });

  it('constructs structured ApiClientError with status, code, and retryAfterSeconds', () => {
    const err = new ApiClientError('Too Many Requests', 429, 'RATE_LIMIT_EXCEEDED', 15);
    expect(err.status).toBe(429);
    expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(err.retryAfterSeconds).toBe(15);
    expect(err.message).toBe('Too Many Requests');
  });
});
