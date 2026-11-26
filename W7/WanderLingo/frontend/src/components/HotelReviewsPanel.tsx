import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  MessageSquarePlus,
  Plus,
  RotateCcw,
  SkipForward,
  Sparkles,
  Star,
  Trash2,
  Volume2,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { apiClient, ApiClientError } from '../services/apiClient';
import type {
  HotelReviewItem,
  HotelReviewTranslateResponse,
  LanguageItem,
  ServicePresetKey,
} from '../types/translate';
import { LanguageCombobox } from './LanguageCombobox';

interface HotelReviewsPanelProps {
  sampleReviews: HotelReviewItem[];
  travelLanguages: LanguageItem[];
  allLanguages: LanguageItem[];
  servicePreset: ServicePresetKey;
  onError: (msg: string | null) => void;
  onOperationComplete: () => void;
}

type StatusFilter = 'all' | 'translated' | 'skipped';

const VIETNAM_REVIEW_PLACES = [
  'Hanoi Heritage Boutique Hotel',
  'Da Nang Oceanfront Resort',
  'Saigon Riverside Grand',
  'Hoi An Lantern Villa',
  'Old Quarter Cozy Stay',
  'Hue Imperial Garden Stay',
  'Da Lat Pine Hill Villa',
  'Phu Quoc Sunset Resort',
];

export const HotelReviewsPanel: React.FC<HotelReviewsPanelProps> = ({
  sampleReviews,
  travelLanguages,
  allLanguages,
  servicePreset,
  onError,
  onOperationComplete,
}) => {
  const { t } = useI18n();
  const [userReviews, setUserReviews] = useState<HotelReviewItem[]>([]);
  const [targetLang, setTargetLang] = useState('en');
  const [authorName, setAuthorName] = useState('');
  const [selectedHotel, setSelectedHotel] = useState(VIETNAM_REVIEW_PLACES[0]);
  const [selectedRating, setSelectedRating] = useState<number>(5);
  const [reviewText, setReviewText] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [isTranslating, setIsTranslating] = useState(false);
  const [batchResult, setBatchResult] = useState<HotelReviewTranslateResponse | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Combine user-posted reviews at the top + verified community guest reviews below
  const allReviews = useMemo(
    () => [...userReviews, ...sampleReviews].slice(0, 25),
    [userReviews, sampleReviews],
  );

  // Clear stale translation banner if preset changes
  useEffect(() => {
    setBatchResult(null);
  }, [servicePreset]);

  const runTranslateFeed = async (
    langOverride?: string,
    reviewsOverride?: HotelReviewItem[],
  ) => {
    const listToTranslate = reviewsOverride ?? allReviews;
    if (listToTranslate.length === 0) return;
    onError(null);
    setIsTranslating(true);
    try {
      const res = await apiClient.translateHotelReviews({
        reviews: listToTranslate,
        targetLanguage: langOverride ?? targetLang,
        servicePreset,
      });
      setBatchResult(res);
      onOperationComplete();
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? `${err.message} (${err.code})`
          : 'Failed to translate guest reviews.';
      onError(msg);
    } finally {
      setIsTranslating(false);
    }
  };

  // V2 Feedback #5 & #6: Editable author name, place & rating; Ctrl+Enter adds to board by default
  const handlePostReview = () => {
    const cleanedText = reviewText.trim();
    if (!cleanedText) return;
    const cleanAuthor = authorName.trim() || 'Guest Traveler';

    const newItem: HotelReviewItem = {
      id: `user-rev-${Date.now()}`,
      author: cleanAuthor,
      hotel_name: selectedHotel,
      rating: selectedRating,
      stay_date: new Date().toISOString().slice(0, 10),
      text: cleanedText,
      isUserAdded: true,
    };

    const nextUserReviews = [newItem, ...userReviews];
    setUserReviews(nextUserReviews);
    setReviewText('');
    setStatusFilter('all');
    setSourceFilter('all');

    // If the feed was already in translated view, refresh translations to include the new post
    if (batchResult) {
      void runTranslateFeed(targetLang, [...nextUserReviews, ...sampleReviews].slice(0, 25));
    }
  };

  const handleDeleteUserReview = (id: string) => {
    setUserReviews((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAllUserReviews = () => {
    setUserReviews([]);
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore
    }
  };

  const handleSpeak = (text: string, langCode: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = langCode;
      window.speechSynthesis.speak(u);
    }
  };

  const uniqueSources = useMemo(() => {
    const set = new Set<string>();
    for (const r of allReviews) {
      if (r.hotel_name) set.add(r.hotel_name);
    }
    return Array.from(set);
  }, [allReviews]);

  const filteredPairs = useMemo(() => {
    return allReviews
      .map((rev) => ({
        rev,
        translatedItem: batchResult?.results.find((r) => r.id === rev.id),
      }))
      .filter(({ rev, translatedItem }) => {
        if (sourceFilter !== 'all' && rev.hotel_name !== sourceFilter) return false;
        if (!translatedItem) return true;
        if (statusFilter === 'translated') return !translatedItem.skipped;
        if (statusFilter === 'skipped') return translatedItem.skipped;
        return true;
      });
  }, [allReviews, batchResult, sourceFilter, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header + Feed Localization Bar + Write a Guest Review Composer */}
      <section className="wl-folio overflow-visible p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-3.5">
            <div
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-warm-soft)] text-[var(--accent-warm)]"
            >
              <Star className="h-6 w-6" />
            </div>
            <h2 className="font-heading text-2xl font-extrabold text-[var(--text-primary)]">
              {t('reviewsHeaderTitle')}
            </h2>
          </div>

          <div className="flex flex-wrap items-end gap-2.5">
            <div className="w-full sm:w-72">
              <LanguageCombobox
                label={t('destinationLanguageLabel')}
                value={targetLang}
                onChange={(code) => {
                  setTargetLang(code);
                  void runTranslateFeed(code);
                }}
                travelLanguages={travelLanguages}
                allLanguages={allLanguages}
              />
            </div>

            <button
              type="button"
              disabled={isTranslating || allReviews.length === 0}
              onClick={() => void runTranslateFeed()}
              className="wl-btn-primary flex min-h-[46px] items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold shadow-xs disabled:opacity-50"
            >
              {isTranslating ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              )}
              <span>
                {isTranslating
                  ? t('translatingBtn')
                  : `${t('translateReviewsBtn')} (${allReviews.length})`}
              </span>
            </button>

            {batchResult && (
              <button
                type="button"
                onClick={() => {
                  setBatchResult(null);
                  setStatusFilter('all');
                }}
                className="flex min-h-[46px] items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-4 py-2.5 text-xs font-bold text-[var(--text-secondary)] transition hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t('showOriginalReviewsBtn')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Write a Guest Review Form (Author Name + Place + Star Rating + Ctrl+Enter Add to Board) */}
        <div className="mt-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]/75 p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)]">
              <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
              {t('writeReviewTitle')}
            </span>
            <span className="font-mono text-xs text-[var(--text-muted)]">Ctrl + Enter</span>
          </div>

          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder={t('reviewerNamePlaceholder')}
              className="min-h-[42px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-solid)] px-3.5 py-2 text-sm font-medium text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
            />

            <select
              aria-label={t('reviewHotelLabel')}
              value={selectedHotel}
              onChange={(e) => setSelectedHotel(e.target.value)}
              className="min-h-[42px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-solid)] px-3.5 py-2 text-sm font-medium text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
            >
              {VIETNAM_REVIEW_PLACES.map((place) => (
                <option key={place} value={place}>
                  {place}
                </option>
              ))}
            </select>

            <div className="flex min-h-[42px] items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-solid)] px-3.5 py-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {t('reviewRatingLabel')}
              </span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setSelectedRating(star)}
                    aria-label={`${star} stars`}
                    className={`p-0.5 transition ${
                      star <= selectedRating
                        ? 'text-[var(--accent-warm)]'
                        : 'text-[var(--border-strong)]'
                    }`}
                  >
                    <Star className="h-4 w-4 fill-current" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <textarea
              rows={2}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handlePostReview();
                }
              }}
              placeholder={t('addCustomReviewPlaceholder')}
              className="flex-1 resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-solid)] p-3.5 text-base text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!reviewText.trim()}
                onClick={handlePostReview}
                className="wl-btn-primary flex min-h-[44px] items-center gap-1.5 rounded-xl px-5 py-2 text-sm font-bold shadow-xs disabled:opacity-45"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>{t('appendReviewsBtn')}</span>
              </button>

              {userReviews.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllUserReviews}
                  className="flex min-h-[44px] items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-[var(--status-warning-text)] transition hover:bg-[var(--status-warning-bg)]"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {t('clearUserReviewsBtn')} ({userReviews.length})
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Filter & Language Breakdown Bar */}
      <section className="wl-card space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {batchResult ? (
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] p-1">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition sm:text-sm ${
                  statusFilter === 'all'
                    ? 'wl-btn-primary'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {t('filterAllBtn')} ({batchResult.summary.total})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('translated')}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition sm:text-sm ${
                  statusFilter === 'translated'
                    ? 'bg-[var(--accent-cyan)] text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {t('filterTranslatedBtn')} ({batchResult.summary.translated_count})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('skipped')}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition sm:text-sm ${
                  statusFilter === 'skipped'
                    ? 'bg-[var(--accent-warm)] text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {t('filterSkippedBtn')} ({batchResult.summary.skipped_count})
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSourceFilter('all')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  sourceFilter === 'all'
                    ? 'wl-btn-primary'
                    : 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {t('allSourcesFilter')} ({allReviews.length})
              </button>
              {uniqueSources.map((src) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setSourceFilter(src)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    sourceFilter === src
                      ? 'wl-btn-primary'
                      : 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {src}
                </button>
              ))}
            </div>
          )}

          {batchResult && (
            <div className="flex flex-wrap items-center gap-1.5">
              {Object.entries(batchResult.summary.language_breakdown).map(([lang, count]) => (
                <span
                  key={lang}
                  className="rounded-md bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-bold text-[var(--accent-primary)]"
                >
                  {lang}: {count}
                </span>
              ))}
              <span className="rounded-md bg-[var(--accent-cyan-soft)] px-2.5 py-1 font-mono text-xs font-bold text-[var(--accent-cyan)]">
                {batchResult.summary.latency_ms} ms
              </span>
            </div>
          )}
        </div>

        {batchResult && uniqueSources.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--border-subtle)] pt-3">
            <button
              type="button"
              onClick={() => setSourceFilter('all')}
              className={`rounded-md px-3 py-1 text-xs font-bold transition ${
                sourceFilter === 'all'
                  ? 'bg-[var(--text-primary)] text-[var(--bg-surface-solid)]'
                  : 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t('allSourcesFilter')}
            </button>
            {uniqueSources.map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => setSourceFilter(src)}
                className={`rounded-md px-3 py-1 text-xs font-bold transition ${
                  sourceFilter === src
                    ? 'bg-[var(--text-primary)] text-[var(--bg-surface-solid)]'
                    : 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {src}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Guest Review Cards Grid */}
      <div
        className={`grid grid-cols-1 gap-5 transition-opacity md:grid-cols-2 ${
          isTranslating ? 'opacity-65' : 'opacity-100'
        }`}
      >
        {filteredPairs.map(({ rev, translatedItem }) => {
          const displayPrimary = translatedItem?.translated ?? rev.text;
          const speakLang = translatedItem ? batchResult?.target_language ?? targetLang : 'en';

          return (
            <article key={rev.id} className="wl-card flex flex-col justify-between p-5 sm:p-6">
              <div>
                {/* Author, Verified/Your Review Tag, Place & Optional Delete (ONLY for user's own reviews) */}
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-heading text-base font-bold text-[var(--text-primary)]">
                        {rev.author}
                      </span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                          rev.isUserAdded
                            ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                            : 'bg-[var(--accent-cyan-soft)] text-[var(--accent-cyan)]'
                        }`}
                      >
                        {rev.isUserAdded ? t('yourReviewBadge') : t('verifiedGuestBadge')}
                      </span>
                      {rev.rating && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-warm-soft)] px-2 py-0.5 text-xs font-bold text-[var(--accent-warm)]">
                          <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                          {rev.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                    {rev.hotel_name && (
                      <div className="mt-0.5 text-xs font-medium text-[var(--text-muted)]">
                        {rev.hotel_name} {rev.stay_date ? `· ${rev.stay_date}` : ''}
                      </div>
                    )}
                  </div>

                  {/* V2 Feedback #4: Only user-added reviews can be deleted; community reviews are permanent */}
                  {rev.isUserAdded && (
                    <button
                      type="button"
                      onClick={() => handleDeleteUserReview(rev.id)}
                      title={t('removeReviewAria')}
                      aria-label={t('removeReviewAria')}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--status-warning-bg)] hover:text-[var(--status-warning-text)]"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>

                {/* Detected Language & Skip Status Badges */}
                {translatedItem && (
                  <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
                    {translatedItem.source_lang_name && (
                      <span className="rounded-md bg-[var(--accent-soft)] px-2.5 py-0.5 font-bold text-[var(--accent-primary)]">
                        {translatedItem.source_lang_name} ({translatedItem.source_lang})
                      </span>
                    )}
                    {translatedItem.confidence !== null && (
                      <span className="rounded-md bg-[var(--bg-surface-muted)] px-2 py-0.5 font-mono text-[var(--text-secondary)]">
                        {Math.round(translatedItem.confidence * 100)}%
                      </span>
                    )}
                    {translatedItem.skipped ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[var(--status-caution-bg)] px-2.5 py-0.5 font-bold text-[var(--status-caution-text)]">
                        <SkipForward className="h-3 w-3" aria-hidden="true" />
                        {t('skippedSameLangBadge')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[var(--status-good-bg)] px-2.5 py-0.5 font-bold text-[var(--status-good-text)]">
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        {batchResult?.target_language_name}
                      </span>
                    )}
                  </div>
                )}

                {/* Review Body */}
                {translatedItem && !translatedItem.skipped ? (
                  <>
                    <div className="rounded-xl border-l-4 border-[var(--btn-primary-bg)] bg-[var(--bg-surface-tint)]/75 p-4">
                      <div className="mb-1 text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)]">
                        {t('translatedReviewLabel')} ({batchResult?.target_language_name})
                      </div>
                      {translatedItem.error ? (
                        <p className="font-semibold text-[var(--status-warning-text)]">
                          {translatedItem.error}
                        </p>
                      ) : (
                        <>
                          <p className="text-base font-bold leading-relaxed text-[var(--text-primary)] sm:text-lg">
                            {displayPrimary}
                          </p>
                          {translatedItem.pronunciation && (
                            <p className="mt-1.5 font-mono text-xs text-[var(--accent-cyan)]">
                              {translatedItem.pronunciation}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                    <div className="mt-3 px-1">
                      <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        {t('originalReviewLabel')}
                      </div>
                      <p className="mt-0.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                        “{rev.text}”
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="wl-well p-4">
                    <p className="text-base leading-relaxed text-[var(--text-primary)]">
                      “{rev.text}”
                    </p>
                  </div>
                )}
              </div>

              {/* Card Bottom Action Rail */}
              <div className="mt-4 flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] pt-3">
                <button
                  type="button"
                  onClick={() => handleSpeak(displayPrimary, speakLang)}
                  className="flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-3 py-1 text-xs font-bold text-[var(--text-primary)] transition hover:border-[var(--accent-cyan)] hover:text-[var(--accent-cyan)]"
                >
                  <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t('speakBtn')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleCopy(rev.id, displayPrimary)}
                  className="flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-3 py-1 text-xs font-bold text-[var(--text-primary)] transition hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
                >
                  {copiedId === rev.id ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                      <span>{t('copiedBtn')}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t('copyBtn')}</span>
                    </>
                  )}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
