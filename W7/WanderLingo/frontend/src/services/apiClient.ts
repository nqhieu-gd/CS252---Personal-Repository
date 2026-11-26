import { API_ROUTES } from '../config/apiConfig';
import type {
  BulkTranslateResponse,
  DestinationTranslateResponse,
  DetectResponse,
  HealthResponse,
  HotelReviewItem,
  HotelReviewTranslateResponse,
  LanguagesResponse,
  ServicePresetKey,
  TranslateResponse,
  TravelInquiryReplyResponse,
  TravelInquiryResponse,
  TravelSamplesResponse,
} from '../types/translate';

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly retryAfterSeconds?: number;

  constructor(message: string, status: number, code = 'API_ERROR', retryAfterSeconds?: number) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

async function requestJson<T>(
  url: string,
  options: RequestInit = {},
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    signal,
  });

  if (!response.ok) {
    const retryHeader = response.headers.get('Retry-After');
    const retrySec = retryHeader ? Number.parseInt(retryHeader, 10) : undefined;
    let errCode = `HTTP_${response.status}`;
    let errMessage = `Request failed with status ${response.status}`;

    try {
      const errBody = (await response.json()) as {
        detail?:
          | string
          | { code?: string; message?: string; retry_after_seconds?: number }
          | Array<{ msg?: string }>;
      };
      if (typeof errBody.detail === 'string') {
        errMessage = errBody.detail;
      } else if (Array.isArray(errBody.detail) && errBody.detail.length > 0) {
        errMessage = errBody.detail.map((d) => d.msg ?? 'Validation error').join('; ');
        errCode = 'VALIDATION_ERROR';
      } else if (
        errBody.detail &&
        typeof errBody.detail === 'object' &&
        !Array.isArray(errBody.detail)
      ) {
        errCode = errBody.detail.code ?? errCode;
        errMessage = errBody.detail.message ?? errMessage;
      }
    } catch {
      // keep default status text
    }

    throw new ApiClientError(errMessage, response.status, errCode, retrySec);
  }

  return (await response.json()) as T;
}

export const apiClient = {
  getHealth: (signal?: AbortSignal) =>
    requestJson<HealthResponse>(API_ROUTES.HEALTH, { method: 'GET' }, signal),

  getLanguages: (signal?: AbortSignal) =>
    requestJson<LanguagesResponse>(API_ROUTES.LANGUAGES, { method: 'GET' }, signal),

  clearCache: (signal?: AbortSignal) =>
    requestJson<{ status: string }>(API_ROUTES.CACHE_CLEAR, { method: 'POST' }, signal),

  getTravelSamples: (signal?: AbortSignal) =>
    requestJson<TravelSamplesResponse>(API_ROUTES.TRAVEL_SAMPLES, { method: 'GET' }, signal),

  detectLanguage: (
    text: string,
    servicePreset: ServicePresetKey = 'default',
    signal?: AbortSignal,
  ) =>
    requestJson<DetectResponse>(
      API_ROUTES.DETECT,
      {
        method: 'POST',
        body: JSON.stringify({ text, service_preset: servicePreset }),
      },
      signal,
    ),

  translateText: (
    params: {
      text: string;
      src: string;
      dest: string;
      servicePreset?: ServicePresetKey;
    },
    signal?: AbortSignal,
  ) =>
    requestJson<TranslateResponse>(
      API_ROUTES.TRANSLATE,
      {
        method: 'POST',
        body: JSON.stringify({
          text: params.text,
          src: params.src,
          dest: params.dest,
          service_preset: params.servicePreset ?? 'default',
        }),
      },
      signal,
    ),

  translateBulk: (
    params: {
      texts: string[];
      src?: string;
      dest: string;
      skipSameLanguage?: boolean;
      servicePreset?: ServicePresetKey;
    },
    signal?: AbortSignal,
  ) =>
    requestJson<BulkTranslateResponse>(
      API_ROUTES.TRANSLATE_BULK,
      {
        method: 'POST',
        body: JSON.stringify({
          texts: params.texts,
          src: params.src ?? 'auto',
          dest: params.dest,
          skip_same_language: params.skipSameLanguage ?? true,
          service_preset: params.servicePreset ?? 'default',
        }),
      },
      signal,
    ),

  translateHotelReviews: (
    params: {
      reviews: HotelReviewItem[];
      targetLanguage: string;
      servicePreset?: ServicePresetKey;
    },
    signal?: AbortSignal,
  ) =>
    requestJson<HotelReviewTranslateResponse>(
      API_ROUTES.TRAVEL_REVIEWS,
      {
        method: 'POST',
        body: JSON.stringify({
          reviews: params.reviews,
          target_language: params.targetLanguage,
          service_preset: params.servicePreset ?? 'default',
        }),
      },
      signal,
    ),

  processTravelInquiry: (
    params: {
      inquiryText: string;
      targetLanguage: string;
      servicePreset?: ServicePresetKey;
    },
    signal?: AbortSignal,
  ) =>
    requestJson<TravelInquiryResponse>(
      API_ROUTES.TRAVEL_INQUIRY,
      {
        method: 'POST',
        body: JSON.stringify({
          inquiry_text: params.inquiryText,
          target_language: params.targetLanguage,
          service_preset: params.servicePreset ?? 'default',
        }),
      },
      signal,
    ),

  translateInquiryReply: (
    params: {
      replyText: string;
      staffLanguage: string;
      guestLanguage: string;
      servicePreset?: ServicePresetKey;
    },
    signal?: AbortSignal,
  ) =>
    requestJson<TravelInquiryReplyResponse>(
      API_ROUTES.TRAVEL_INQUIRY_REPLY,
      {
        method: 'POST',
        body: JSON.stringify({
          reply_text: params.replyText,
          staff_language: params.staffLanguage,
          guest_language: params.guestLanguage,
          service_preset: params.servicePreset ?? 'default',
        }),
      },
      signal,
    ),

  translateDestinationInfo: (
    params: {
      destinationData: Record<string, unknown>;
      targetLanguage: string;
      servicePreset?: ServicePresetKey;
    },
    signal?: AbortSignal,
  ) =>
    requestJson<DestinationTranslateResponse>(
      API_ROUTES.TRAVEL_DESTINATION,
      {
        method: 'POST',
        body: JSON.stringify({
          destination_data: params.destinationData,
          target_language: params.targetLanguage,
          service_preset: params.servicePreset ?? 'default',
        }),
      },
      signal,
    ),
};
