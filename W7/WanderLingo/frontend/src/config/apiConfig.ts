/**
 * Centralized frontend API route configuration.
 * Never hardcode API URLs inside React components.
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export const API_ROUTES = {
  HEALTH: `${BASE_URL}/api/health`,
  LANGUAGES: `${BASE_URL}/api/languages`,
  CACHE_CLEAR: `${BASE_URL}/api/cache/clear`,
  DETECT: `${BASE_URL}/api/detect`,
  TRANSLATE: `${BASE_URL}/api/translate`,
  TRANSLATE_BULK: `${BASE_URL}/api/translate/bulk`,
  TRAVEL_SAMPLES: `${BASE_URL}/api/travel/samples`,
  TRAVEL_REVIEWS: `${BASE_URL}/api/travel/reviews`,
  TRAVEL_INQUIRY: `${BASE_URL}/api/travel/inquiry`,
  TRAVEL_INQUIRY_REPLY: `${BASE_URL}/api/travel/inquiry/reply`,
  TRAVEL_DESTINATION: `${BASE_URL}/api/travel/destination`,
} as const;

export const MAX_TEXT_LENGTH = 5000;
export const MAX_HISTORY_ITEMS = 25;
