import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Plus,
  RotateCcw,
  SkipForward,
  Sparkles,
  Star,
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

export const HotelReviewsPanel: React.FC<HotelReviewsPanelProps> = ({
  sampleReviews,
  travelLanguages,
  allLanguages,
  servicePreset,
  onError,
  onOperationComplete,
}) => {
  const { t } = useI18n();
  const [reviews, setReviews] = useState<HotelReviewItem[]>(sampleReviews);
  const [targetLang, setTargetLang] = useState('en');
  const [customBatchText, setCustomBatchText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [batchResult, setBatchResult] = useState<HotelReviewTranslateResponse | null>(null);

  useEffect(() => {
    if (sampleReviews.length > 0 && reviews.length === 0) {
      setReviews(sampleReviews);
    }
  }, [sampleReviews, reviews.length]);

  const handleTranslateAll = async () => {
    if (reviews.length === 0) return;
    onError(null);
    setIsTranslating(true);
    try {
      const res = await apiClient.translateHotelReviews({
        reviews,
        targetLanguage: targetLang,
        servicePreset,
      });
      setBatchResult(res);
      onOperationComplete();
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? `${err.message} (${err.code})`
          : 'Failed to translate hotel reviews.';
      onError(msg);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleAppendCustomReviews = () => {
    const lines = customBatchText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) return;

    const newItems: HotelReviewItem[] = lines.map((line, i) => ({
      id: `custom-${Date.now()}-${i}`,
      author: `Verified Guest #${reviews.length + i + 1}`,
      hotel_name: 'WanderLingo Partner Stay',
      rating: 5.0,
      stay_date: new Date().toISOString().slice(0, 10),
      text: line,
    }));

    setReviews((prev) => [...newItems, ...prev].slice(0, 25));
    setCustomBatchText('');
    setBatchResult(null);
  };

  const handleResetSamples = () => {
    setReviews(sampleReviews);
    setBatchResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <section className="wl-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-warm-soft)] text-[var(--accent-warm)]"
            >
              <Star className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-heading text-xl font-extrabold text-[var(--text-primary)]">
                {t('reviewsHeaderTitle')}
              </h2>
              <p className="mt-1 max-w-3xl text-base text-[var(--text-secondary)]">
                {t('reviewsHeaderSubtitle')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetSamples}
            className="flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-4 py-2 text-sm font-bold text-[var(--text-primary)] transition hover:border-[var(--accent-primary)]"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            <span>{t('resetSampleReviewsBtn')}</span>
          </button>
        </div>

        {/* Custom Bulk Review Input */}
        <div className="wl-well mt-5 p-4">
          <div className="mb-2 text-sm font-bold text-[var(--text-primary)]">
            {t('addCustomReviewTitle')}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <textarea
              rows={2}
              value={customBatchText}
              onChange={(e) => setCustomBatchText(e.target.value)}
              placeholder={t('addCustomReviewPlaceholder')}
              className="flex-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 text-base text-[var(--text-primary)]"
            />
            <button
              type="button"
              disabled={!customBatchText.trim()}
              onClick={handleAppendCustomReviews}
              className="flex min-h-[46px] shrink-0 items-center justify-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--bg-surface)] px-5 py-2.5 text-sm font-bold text-[var(--text-primary)] transition hover:border-[var(--accent-primary)] disabled:opacity-50"
            >
              <Plus className="h-4 w-4 text-[var(--accent-primary)]" aria-hidden="true" />
              <span>{t('appendReviewsBtn')}</span>
            </button>
          </div>
        </div>

        {/* Target Language & Batch Translate Button */}
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-[var(--border-subtle)] pt-5">
          <div className="w-full sm:w-80">
            <LanguageCombobox
              label={t('targetLanguage')}
              value={targetLang}
              onChange={(code) => {
                setTargetLang(code);
                setBatchResult(null);
              }}
              travelLanguages={travelLanguages}
              allLanguages={allLanguages}
            />
          </div>

          <button
            type="button"
            disabled={isTranslating || reviews.length === 0}
            onClick={() => void handleTranslateAll()}
            className="flex min-h-[46px] items-center gap-2 rounded-full bg-[var(--accent-primary)] px-6 py-2.5 text-base font-bold text-white shadow-sm transition hover:bg-[var(--accent-primary-hover)] disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span>
              {isTranslating
                ? t('translatingBtn')
                : `${t('translateAllReviewsBtn')} (${reviews.length})`}
            </span>
          </button>
        </div>
      </section>

      {/* Summary KPI Bar */}
      {batchResult && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="wl-card p-4 sm:p-5">
            <div className="text-sm font-semibold text-[var(--text-muted)]">{t('summaryTotal')}</div>
            <div className="font-heading mt-1 text-3xl font-extrabold text-[var(--text-primary)]">
              {batchResult.summary.total}
            </div>
          </div>
          <div className="wl-card p-4 sm:p-5">
            <div className="text-sm font-semibold text-[var(--text-muted)]">
              {t('summaryTranslated')}
            </div>
            <div className="font-heading mt-1 text-3xl font-extrabold text-[var(--status-good-text)]">
              {batchResult.summary.translated_count}
            </div>
          </div>
          <div className="wl-card p-4 sm:p-5">
            <div className="text-sm font-semibold text-[var(--text-muted)]">
              {t('summarySkipped')}
            </div>
            <div className="font-heading mt-1 text-3xl font-extrabold text-[var(--status-caution-text)]">
              {batchResult.summary.skipped_count}
            </div>
          </div>
          <div className="wl-card p-4 sm:p-5">
            <div className="text-sm font-semibold text-[var(--text-muted)]">
              {t('summaryLangBreakdown')}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(batchResult.summary.language_breakdown).map(([lang, count]) => (
                <span
                  key={lang}
                  className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-bold text-[var(--accent-primary)]"
                >
                  {lang}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Review Cards Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {reviews.map((rev, idx) => {
          const translatedItem =
            batchResult?.results.find((r) => r.id === rev.id) ?? batchResult?.results[idx];

          return (
            <article key={rev.id} className="wl-card flex flex-col justify-between p-5 sm:p-6">
              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-heading text-lg font-bold text-[var(--text-primary)]">
                      {rev.author}
                    </div>
                    {rev.hotel_name && (
                      <div className="text-sm text-[var(--text-muted)]">
                        {rev.hotel_name} {rev.stay_date ? `· ${rev.stay_date}` : ''}
                      </div>
                    )}
                  </div>

                  {rev.rating && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-warm-soft)] px-3 py-1 text-sm font-bold text-[var(--accent-warm)]">
                      <Star className="h-4 w-4 fill-current" aria-hidden="true" />
                      {rev.rating.toFixed(1)}
                    </span>
                  )}
                </div>

                {/* Detected Language & Skip/Confidence Badges */}
                {translatedItem && (
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                    {translatedItem.source_lang_name && (
                      <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 font-bold text-[var(--accent-primary)]">
                        {translatedItem.source_lang_name} ({translatedItem.source_lang})
                      </span>
                    )}
                    {translatedItem.confidence !== null && (
                      <span className="rounded-full bg-[var(--bg-surface-muted)] px-2.5 py-1 font-mono text-[var(--text-secondary)]">
                        {t('confidenceBadge')}: {Math.round(translatedItem.confidence * 100)}%
                      </span>
                    )}
                    {translatedItem.skipped ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--status-caution-bg)] px-3 py-1 font-bold text-[var(--status-caution-text)]">
                        <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('skippedSameLangBadge')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--status-good-bg)] px-3 py-1 font-bold text-[var(--status-good-text)]">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {batchResult?.target_language_name}
                      </span>
                    )}
                  </div>
                )}

                {/* Original Review */}
                <div className="wl-well p-4">
                  <div className="mb-1 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    {t('originalReviewLabel')}
                  </div>
                  <p className="text-base leading-relaxed text-[var(--text-primary)]">{rev.text}</p>
                </div>

                {/* Translated Review */}
                {translatedItem && (
                  <div className="mt-3 rounded-2xl border border-[var(--accent-primary)]/30 bg-[var(--accent-soft)] p-4">
                    <div className="mb-1 text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)]">
                      {t('translatedReviewLabel')} ({batchResult?.target_language_name})
                    </div>
                    {translatedItem.error ? (
                      <p className="font-semibold text-[var(--status-warning-text)]">
                        {translatedItem.error}
                      </p>
                    ) : (
                      <>
                        <p className="text-base font-bold leading-relaxed text-[var(--text-primary)]">
                          {translatedItem.translated}
                        </p>
                        {translatedItem.pronunciation && (
                          <p className="mt-1.5 font-mono text-sm text-[var(--text-secondary)]">
                            {translatedItem.pronunciation}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
