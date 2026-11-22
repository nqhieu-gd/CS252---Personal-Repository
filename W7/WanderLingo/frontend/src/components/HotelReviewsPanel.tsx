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
      author: `Custom Traveler #${reviews.length + i + 1}`,
      hotel_name: 'WanderLingo Partner Hotel',
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
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-[var(--text-primary)] sm:text-lg">
              <Star className="h-5 w-5 text-amber-400" />
              <span>{t('reviewsHeaderTitle')}</span>
            </h2>
            <p className="mt-1 max-w-3xl text-xs text-[var(--text-secondary)] sm:text-sm">
              {t('reviewsHeaderSubtitle')}
            </p>
          </div>

          <button
            type="button"
            onClick={handleResetSamples}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{t('resetSampleReviewsBtn')}</span>
          </button>
        </div>

        {/* Custom Bulk Review Input */}
        <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] p-3.5">
          <div className="mb-1.5 text-xs font-semibold text-[var(--text-primary)]">
            {t('addCustomReviewTitle')}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <textarea
              rows={2}
              value={customBatchText}
              onChange={(e) => setCustomBatchText(e.target.value)}
              placeholder={t('addCustomReviewPlaceholder')}
              className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
            />
            <button
              type="button"
              disabled={!customBatchText.trim()}
              onClick={handleAppendCustomReviews}
              className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)] disabled:opacity-50"
            >
              <Plus className="h-4 w-4 text-[var(--accent-primary)]" />
              <span>{t('appendReviewsBtn')}</span>
            </button>
          </div>
        </div>

        {/* Target Language & Batch Translate Button */}
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
          <div className="w-full sm:w-72">
            <LanguageCombobox
              label={t('targetLanguage')}
              value={targetLang}
              onChange={setTargetLang}
              travelLanguages={travelLanguages}
              allLanguages={allLanguages}
            />
          </div>

          <button
            type="button"
            disabled={isTranslating || reviews.length === 0}
            onClick={() => void handleTranslateAll()}
            className="flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[var(--accent-primary-hover)] disabled:opacity-50 sm:text-sm"
          >
            <Sparkles className="h-4 w-4" />
            <span>
              {isTranslating
                ? t('translatingBtn')
                : `${t('translateAllReviewsBtn')} (${reviews.length})`}
            </span>
          </button>
        </div>
      </div>

      {/* Summary KPI Bar */}
      {batchResult && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5">
            <div className="text-xs text-[var(--text-muted)]">{t('summaryTotal')}</div>
            <div className="mt-1 text-xl font-bold text-[var(--text-primary)]">
              {batchResult.summary.total}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5">
            <div className="text-xs text-[var(--text-muted)]">{t('summaryTranslated')}</div>
            <div className="mt-1 text-xl font-bold text-[var(--status-good-text)]">
              {batchResult.summary.translated_count}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5">
            <div className="text-xs text-[var(--text-muted)]">{t('summarySkipped')}</div>
            <div className="mt-1 text-xl font-bold text-[var(--status-caution-text)]">
              {batchResult.summary.skipped_count}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5">
            <div className="text-xs text-[var(--text-muted)]">{t('summaryLangBreakdown')}</div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {Object.entries(batchResult.summary.language_breakdown).map(([lang, count]) => (
                <span
                  key={lang}
                  className="rounded-md bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent-primary)]"
                >
                  {lang}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Review Cards Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {reviews.map((rev, idx) => {
          const translatedItem =
            batchResult?.results.find((r) => r.id === rev.id) ?? batchResult?.results[idx];

          return (
            <div
              key={rev.id}
              className="flex flex-col justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-xs"
            >
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-[var(--text-primary)]">{rev.author}</div>
                    {rev.hotel_name && (
                      <div className="text-xs text-[var(--text-muted)]">
                        {rev.hotel_name} {rev.stay_date ? `· ${rev.stay_date}` : ''}
                      </div>
                    )}
                  </div>

                  {rev.rating && (
                    <span className="flex items-center gap-1 rounded-lg bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-500">
                      <Star className="h-3.5 w-3.5 fill-amber-400" />
                      {rev.rating.toFixed(1)}
                    </span>
                  )}
                </div>

                {/* Detected Language & Skip/Confidence Badges */}
                {translatedItem && (
                  <div className="mb-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                    {translatedItem.source_lang_name && (
                      <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 font-semibold text-[var(--accent-primary)]">
                        {translatedItem.source_lang_name} ({translatedItem.source_lang})
                      </span>
                    )}
                    {translatedItem.confidence !== null && (
                      <span className="rounded-full bg-[var(--bg-surface-muted)] px-2 py-0.5 font-mono text-[var(--text-secondary)]">
                        {t('confidenceBadge')}: {Math.round(translatedItem.confidence * 100)}%
                      </span>
                    )}
                    {translatedItem.skipped ? (
                      <span className="flex items-center gap-1 rounded-full bg-[var(--status-caution-bg)] px-2.5 py-0.5 font-semibold text-[var(--status-caution-text)]">
                        <SkipForward className="h-3 w-3" />
                        {t('skippedSameLangBadge')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full bg-[var(--status-good-bg)] px-2.5 py-0.5 font-semibold text-[var(--status-good-text)]">
                        <CheckCircle2 className="h-3 w-3" />
                        {batchResult?.target_language_name}
                      </span>
                    )}
                  </div>
                )}

                {/* Original Review */}
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] p-3 text-xs">
                  <div className="mb-1 font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    {t('originalReviewLabel')}
                  </div>
                  <p className="text-sm text-[var(--text-primary)]">{rev.text}</p>
                </div>

                {/* Translated Review */}
                {translatedItem && (
                  <div className="mt-2.5 rounded-xl border border-[var(--accent-primary)]/30 bg-[var(--accent-soft)]/40 p-3 text-xs">
                    <div className="mb-1 font-semibold uppercase tracking-wider text-[var(--accent-primary)]">
                      {t('translatedReviewLabel')} ({batchResult?.target_language_name})
                    </div>
                    {translatedItem.error ? (
                      <p className="font-semibold text-[var(--status-warning-text)]">
                        {translatedItem.error}
                      </p>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {translatedItem.translated}
                        </p>
                        {translatedItem.pronunciation && (
                          <p className="mt-1 font-mono text-xs text-[var(--text-secondary)]">
                            {translatedItem.pronunciation}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
