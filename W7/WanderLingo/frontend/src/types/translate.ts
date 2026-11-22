export type Locale = 'en' | 'vi';
export type ThemeMode = 'light' | 'dark';
export type ServicePresetKey = 'default' | 'direct' | 'redundant';
export type WorkspaceTab = 'translator' | 'destinations' | 'reviews' | 'inquiries';

export interface ServicePresetInfo {
  key: ServicePresetKey;
  label: string;
  urls: string[];
}

export interface HealthResponse {
  status: string;
  app_name: string;
  app_version: string;
  googletrans_version: string;
  default_preset: ServicePresetKey;
  active_presets: ServicePresetInfo[];
  cache_size: number;
  cache_max_entries: number;
  cache_ttl_seconds: number;
  cache_hits: number;
  cache_misses: number;
}

export interface LanguageItem {
  code: string;
  name: string;
}

export interface LanguagesResponse {
  total_count: number;
  travel_languages: LanguageItem[];
  all_languages: LanguageItem[];
  aliases: Record<string, string>;
}

export interface DetectResponse {
  text: string;
  lang: string;
  lang_name: string;
  confidence: number | null;
  cached: boolean;
  service_preset: ServicePresetKey;
  latency_ms: number;
}

export interface TranslateResponse {
  origin: string;
  text: string;
  src: string;
  src_name: string;
  dest: string;
  dest_name: string;
  pronunciation: string | null;
  confidence: number | null;
  skipped: boolean;
  cached: boolean;
  service_preset: ServicePresetKey;
  latency_ms: number;
}

export interface BulkItemResult {
  index: number;
  origin: string;
  translated: string | null;
  src: string | null;
  src_name: string | null;
  dest: string;
  dest_name: string;
  pronunciation: string | null;
  confidence: number | null;
  skipped: boolean;
  cached: boolean;
  error: string | null;
}

export interface BulkSummary {
  total: number;
  translated_count: number;
  skipped_count: number;
  failed_count: number;
  cached_count: number;
  language_breakdown: Record<string, number>;
  latency_ms: number;
}

export interface BulkTranslateResponse {
  items: BulkItemResult[];
  summary: BulkSummary;
  service_preset: ServicePresetKey;
}

export interface SampleDestination {
  id: string;
  badge: string;
  country: string;
  data: Record<string, string | number | boolean>;
}

export interface HotelReviewItem {
  id: string;
  author: string;
  hotel_name?: string;
  rating?: number;
  stay_date?: string;
  text: string;
}

export interface HotelReviewResult {
  id: string;
  author: string;
  hotel_name?: string | null;
  rating?: number | null;
  stay_date?: string | null;
  original: string;
  translated: string | null;
  source_lang: string | null;
  source_lang_name: string | null;
  confidence: number | null;
  pronunciation: string | null;
  skipped: boolean;
  cached: boolean;
  error: string | null;
}

export interface HotelReviewTranslateResponse {
  target_language: string;
  target_language_name: string;
  results: HotelReviewResult[];
  summary: BulkSummary;
  service_preset: ServicePresetKey;
}

export interface SampleTravelInquiry {
  id: string;
  guest_name: string;
  channel: string;
  badge: string;
  inquiry_text: string;
  suggested_reply_en: string;
}

export interface TravelInquiryResponse {
  original_text: string;
  detected_lang: string;
  detected_language: string;
  confidence: number | null;
  target_lang: string;
  target_language: string;
  translated_text: string;
  pronunciation: string | null;
  needs_translation: boolean;
  cached: boolean;
  service_preset: ServicePresetKey;
  latency_ms: number;
}

export interface TravelInquiryReplyResponse {
  staff_text: string;
  translated_reply: string;
  src: string;
  src_name: string;
  dest: string;
  dest_name: string;
  pronunciation: string | null;
  skipped: boolean;
  cached: boolean;
  service_preset: ServicePresetKey;
  latency_ms: number;
}

export interface DestinationTranslateResponse {
  target_language: string;
  target_language_name: string;
  original_data: Record<string, unknown>;
  translated_data: Record<string, unknown>;
  translated_fields: string[];
  preserved_fields: string[];
  field_errors: Record<string, string>;
  cached_fields_count: number;
  service_preset: ServicePresetKey;
  latency_ms: number;
}

export interface PhrasebookCategory {
  category: string;
  label_en: string;
  label_vi: string;
  phrases: string[];
}

export interface TravelSamplesResponse {
  destinations: SampleDestination[];
  reviews: HotelReviewItem[];
  inquiries: SampleTravelInquiry[];
  phrasebook: PhrasebookCategory[];
}

export interface TranslationHistoryEntry {
  id: string;
  timestampIso: string;
  origin: string;
  translated: string;
  src: string;
  srcName: string;
  dest: string;
  destName: string;
  pronunciation: string | null;
}
