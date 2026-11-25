import React, { useState } from 'react';
import { Code2, Compass, Download, MapPin, Sparkles, Tag } from 'lucide-react';
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
    estimated_daily_budget_usd: 40,
    recommended_stay_days: 3,
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

  const handleDownloadJson = () => {
    if (!translationResult) return;
    const blob = new Blob([JSON.stringify(translationResult.translated_data, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WanderLingo_Guide_${translationResult.target_language}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeSourceData: Record<string, unknown> = isCustomMode
    ? (() => {
        try {
          const parsed = JSON.parse(customJsonText) as unknown;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
          }
          return {};
        } catch {
          return {};
        }
      })()
    : (selectedSample?.data ?? {});

  const formatFieldValue = (val: unknown): string => {
    if (val === null) return 'null';
    if (val === undefined) return '';
    if (typeof val === 'object') {
      try {
        return JSON.stringify(val);
      } catch {
        return String(val);
      }
    }
    return String(val);
  };

  const formatFieldLabel = (key: string) =>
    key
      .replace(/_usd$/i, ' (USD)')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/\(Usd\)/g, '(USD)');

  return (
    <div className="space-y-6">
      {/* Sculpted Header & Destination Picker Card */}
      <section className="wl-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-primary)]"
            >
              <Compass className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-heading text-xl font-extrabold text-[var(--text-primary)]">
                {t('destHeaderTitle')}
              </h2>
              <p className="mt-1 max-w-3xl text-base text-[var(--text-secondary)]">
                {t('destHeaderSubtitle')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsCustomMode((prev) => !prev);
              setTranslationResult(null);
            }}
            className="flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-4 py-2 text-sm font-bold text-[var(--text-primary)] transition hover:border-[var(--accent-primary)]"
          >
            <Code2 className="h-4 w-4 text-[var(--accent-primary)]" aria-hidden="true" />
            <span>{isCustomMode ? t('curatedModeBtn') : t('customJsonModeBtn')}</span>
          </button>
        </div>

        {/* Curated Destination Pills OR Custom JSON Editor */}
        {!isCustomMode ? (
          <div className="mt-5">
            <div className="mb-2.5 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t('selectDestinationLabel')}
            </div>
            <div className="flex flex-wrap gap-2.5">
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
                    aria-pressed={active}
                    className={`flex min-h-[44px] items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition sm:text-base ${
                      active
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white shadow-sm'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{String(dest.data.name)}</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
                      }`}
                    >
                      {dest.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <p className="mb-2 text-sm text-[var(--text-secondary)]">{t('customJsonHelp')}</p>
            <textarea
              rows={8}
              value={customJsonText}
              onChange={(e) => setCustomJsonText(e.target.value)}
              className="wl-well w-full p-4 font-mono text-sm text-[var(--text-primary)]"
            />
          </div>
        )}

        {/* Target Language & Translate Action */}
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-[var(--border-subtle)] pt-5">
          <div className="w-full sm:w-80">
            <LanguageCombobox
              label={t('targetLanguage')}
              value={targetLang}
              onChange={(code) => {
                setTargetLang(code);
                setTranslationResult(null);
              }}
              travelLanguages={travelLanguages}
              allLanguages={allLanguages}
            />
          </div>

          <button
            type="button"
            disabled={isTranslating}
            onClick={() => void handleTranslateGuide()}
            className="flex min-h-[46px] items-center gap-2 rounded-full bg-[var(--accent-primary)] px-6 py-2.5 text-base font-bold text-white shadow-sm transition hover:bg-[var(--accent-primary-hover)] disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span>{isTranslating ? t('translatingBtn') : t('translateGuideBtn')}</span>
          </button>
        </div>
      </section>

      {/* Side-by-Side Structured Comparison */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Original Destination Record */}
        <section className="wl-card p-5 sm:p-6">
          <h3 className="font-heading mb-4 text-base font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {t('originalFieldsTitle')}
          </h3>
          <div className="space-y-3">
            {Object.entries(activeSourceData).map(([key, val]) => {
              const isString = typeof val === 'string' && val.trim().length > 0;
              return (
                <div key={key} className="wl-well p-4">
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-bold text-[var(--text-primary)]">
                      {formatFieldLabel(key)}
                    </span>
                    <span className="rounded-full bg-[var(--bg-surface)] px-2.5 py-0.5 font-mono text-xs text-[var(--text-muted)]">
                      {isString ? 'text' : typeof val}
                    </span>
                  </div>
                  <div className="text-base leading-relaxed text-[var(--text-secondary)]">
                    {formatFieldValue(val)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Translated Destination Record */}
        <section className="wl-card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-heading text-base font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t('translatedFieldsTitle')}
            </h3>
            {translationResult && (
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold text-[var(--accent-primary)]">
                  {translationResult.target_language_name} ({translationResult.target_language}) ·{' '}
                  {translationResult.latency_ms} ms
                </span>
                <button
                  type="button"
                  onClick={handleDownloadJson}
                  title="Download JSON"
                  aria-label="Download Translated JSON"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>

          {!translationResult ? (
            <div className="wl-well flex min-h-[280px] items-center justify-center border-dashed p-6 text-center text-base text-[var(--text-muted)]">
              {isTranslating ? t('translatingBtn') : t('translateGuideBtn')}
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(translationResult.translated_data).map(([key, val]) => {
                const isTranslated = translationResult.translated_fields.includes(key);
                return (
                  <div key={key} className="wl-well p-4">
                    <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                      <span className="font-bold text-[var(--text-primary)]">
                        {formatFieldLabel(key)}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          isTranslated
                            ? 'bg-[var(--status-good-bg)] text-[var(--status-good-text)]'
                            : 'bg-[var(--status-caution-bg)] text-[var(--status-caution-text)]'
                        }`}
                      >
                        <Tag className="h-3 w-3" aria-hidden="true" />
                        {isTranslated ? t('translatedStringTag') : t('preservedValueTag')}
                      </span>
                    </div>
                    <div className="text-base font-semibold leading-relaxed text-[var(--text-primary)]">
                      {formatFieldValue(val)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
