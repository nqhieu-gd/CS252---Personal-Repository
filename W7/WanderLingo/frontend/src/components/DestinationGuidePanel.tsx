import React, { useState } from 'react';
import { Code2, Compass, Sparkles, Tag } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { apiClient, ApiClientError } from '../services/apiClient';
import type {
  DestinationTranslateResponse,
  LanguageItem,
  SampleDestination,
  ServicePresetKey,
} from '../types/translate';
import { LanguageCombobox } from './LanguageCombobox';

interface DestinationGuidePanelProps {
  destinations: SampleDestination[];
  travelLanguages: LanguageItem[];
  allLanguages: LanguageItem[];
  servicePreset: ServicePresetKey;
  onError: (msg: string | null) => void;
  onOperationComplete: () => void;
}

const DEFAULT_CUSTOM_JSON = JSON.stringify(
  {
    name: 'Hoi An Ancient Town',
    description: 'A UNESCO World Heritage river port famous for yellow merchant houses and silk lanterns.',
    attractions: 'Japanese Covered Bridge, Thu Bon River Night Market, An Bang Beach',
    food_specialties: 'Cao Lau Noodles, White Rose Dumplings, Banh Mi Phuong',
    best_time_to_visit: 'February to April for cool breezes and lantern festivals',
    avg_daily_budget_usd: 40,
    visitor_rating: 4.9,
  },
  null,
  2,
);

export const DestinationGuidePanel: React.FC<DestinationGuidePanelProps> = ({
  destinations,
  travelLanguages,
  allLanguages,
  servicePreset,
  onError,
  onOperationComplete,
}) => {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState<string>(destinations[0]?.id ?? 'hanoi');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customJsonText, setCustomJsonText] = useState(DEFAULT_CUSTOM_JSON);
  const [targetLang, setTargetLang] = useState('vi');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationResult, setTranslationResult] =
    useState<DestinationTranslateResponse | null>(null);

  const selectedSample =
    destinations.find((d) => d.id === selectedId) ?? destinations[0];

  const handleTranslateGuide = async () => {
    onError(null);
    let payloadData: Record<string, unknown> = {};

    if (isCustomMode) {
      try {
        const parsed = JSON.parse(customJsonText) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          onError(t('invalidJsonError'));
          return;
        }
        payloadData = parsed as Record<string, unknown>;
      } catch {
        onError(t('invalidJsonError'));
        return;
      }
    } else if (selectedSample) {
      payloadData = { ...selectedSample.data };
    }

    setIsTranslating(true);
    try {
      const res = await apiClient.translateDestinationInfo({
        destinationData: payloadData,
        targetLanguage: targetLang,
        servicePreset,
      });
      setTranslationResult(res);
      onOperationComplete();
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? `${err.message} (${err.code})`
          : 'Failed to translate destination guide.';
      onError(msg);
    } finally {
      setIsTranslating(false);
    }
  };

  const activeSourceData: Record<string, unknown> = isCustomMode
    ? (() => {
        try {
          return JSON.parse(customJsonText) as Record<string, unknown>;
        } catch {
          return {};
        }
      })()
    : (selectedSample?.data ?? {});

  const formatFieldLabel = (key: string) =>
    key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="space-y-6">
      {/* Header & Controls Card */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-[var(--text-primary)] sm:text-lg">
              <Compass className="h-5 w-5 text-[var(--accent-primary)]" />
              <span>{t('destHeaderTitle')}</span>
            </h2>
            <p className="mt-1 max-w-3xl text-xs text-[var(--text-secondary)] sm:text-sm">
              {t('destHeaderSubtitle')}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsCustomMode((prev) => !prev);
              setTranslationResult(null);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] transition hover:border-[var(--accent-primary)]"
          >
            <Code2 className="h-4 w-4 text-[var(--accent-primary)]" />
            <span>{isCustomMode ? t('curatedModeBtn') : t('customJsonModeBtn')}</span>
          </button>
        </div>

        {/* Curated Destination Pills OR Custom JSON Editor */}
        {!isCustomMode ? (
          <div className="mt-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {t('selectDestinationLabel')}
            </div>
            <div className="flex flex-wrap gap-2">
              {destinations.map((dest) => {
                const active = dest.id === selectedId;
                return (
                  <button
                    key={dest.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(dest.id);
                      setTranslationResult(null);
                    }}
                    className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition sm:text-sm ${
                      active
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span>{String(dest.data.name)}</span>
                    <span className="rounded-md bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-medium opacity-80">
                      {dest.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <p className="mb-2 text-xs text-[var(--text-secondary)]">{t('customJsonHelp')}</p>
            <textarea
              rows={8}
              value={customJsonText}
              onChange={(e) => setCustomJsonText(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] p-3 font-mono text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
            />
          </div>
        )}

        {/* Target Language & Translate Action */}
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
            disabled={isTranslating}
            onClick={() => void handleTranslateGuide()}
            className="flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[var(--accent-primary-hover)] disabled:opacity-50 sm:text-sm"
          >
            <Sparkles className="h-4 w-4" />
            <span>{isTranslating ? t('translatingBtn') : t('translateGuideBtn')}</span>
          </button>
        </div>
      </div>

      {/* Side-by-Side Structured Comparison */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Original Destination Record */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {t('originalFieldsTitle')}
          </h3>
          <div className="space-y-3">
            {Object.entries(activeSourceData).map(([key, val]) => {
              const isString = typeof val === 'string' && val.trim().length > 0;
              return (
                <div
                  key={key}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] p-3"
                >
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-bold text-[var(--text-primary)]">
                      {formatFieldLabel(key)}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--text-muted)]">
                      {isString ? 'str' : typeof val}
                    </span>
                  </div>
                  <div className="text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
                    {String(val)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Translated Destination Record */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t('translatedFieldsTitle')}
            </h3>
            {translationResult && (
              <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--accent-primary)]">
                {translationResult.target_language_name} ({translationResult.target_language}) ·{' '}
                {translationResult.latency_ms} ms
              </span>
            )}
          </div>

          {!translationResult ? (
            <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle)] p-6 text-center text-xs text-[var(--text-muted)] sm:text-sm">
              {isTranslating ? t('translatingBtn') : t('translateGuideBtn')}
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(translationResult.translated_data).map(([key, val]) => {
                const isTranslated = translationResult.translated_fields.includes(key);
                return (
                  <div
                    key={key}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] p-3"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-[var(--text-primary)]">
                        {formatFieldLabel(key)}
                      </span>
                      <span
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          isTranslated
                            ? 'bg-[var(--status-good-bg)] text-[var(--status-good-text)]'
                            : 'bg-[var(--status-caution-bg)] text-[var(--status-caution-text)]'
                        }`}
                      >
                        <Tag className="h-2.5 w-2.5" />
                        {isTranslated ? t('translatedStringTag') : t('preservedValueTag')}
                      </span>
                    </div>
                    <div className="text-xs font-medium leading-relaxed text-[var(--text-primary)] sm:text-sm">
                      {String(val)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
