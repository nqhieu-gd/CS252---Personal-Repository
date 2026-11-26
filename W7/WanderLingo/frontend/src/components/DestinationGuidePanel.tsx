import React, { useEffect, useRef, useState } from 'react';
import { Calendar, Compass, Lightbulb, Loader2, MapPin, Utensils, Wallet } from 'lucide-react';
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
  const [targetLang, setTargetLang] = useState('en');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationResult, setTranslationResult] =
    useState<DestinationTranslateResponse | null>(null);

  const onErrorRef = useRef(onError);
  const onCompleteRef = useRef(onOperationComplete);
  onErrorRef.current = onError;
  onCompleteRef.current = onOperationComplete;

  const selectedSample =
    destinations.find((d) => d.id === selectedId) ?? destinations[0];

  // Feedback #13: Automatically translate & replace guide info when Language changes
  useEffect(() => {
    if (!selectedSample) return;
    if (targetLang === 'en') {
      setTranslationResult(null);
      setIsTranslating(false);
      return;
    }

    const controller = new AbortController();
    setIsTranslating(true);
    onErrorRef.current(null);

    apiClient
      .translateDestinationInfo(
        {
          destinationData: { ...selectedSample.data },
          targetLanguage: targetLang,
          servicePreset,
        },
        controller.signal,
      )
      .then((res) => {
        if (!controller.signal.aborted) {
          setTranslationResult(res);
          onCompleteRef.current();
        }
      })
      .catch((err: unknown) => {
        if ((err as Error).name === 'AbortError' || controller.signal.aborted) return;
        const msg =
          err instanceof ApiClientError
            ? `${err.message} (${err.code})`
            : 'Failed to translate destination guide.';
        onErrorRef.current(msg);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsTranslating(false);
        }
      });

    return () => controller.abort();
  }, [selectedSample, targetLang, servicePreset]);

  const activeData: Record<string, unknown> =
    targetLang !== 'en' && translationResult
      ? translationResult.translated_data
      : (selectedSample?.data ?? {});

  const formatFieldValue = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    return String(val);
  };

  const formatFieldLabel = (key: string) =>
    key
      .replace(/_usd$/i, ' (USD)')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/\(Usd\)/g, '(USD)');

  const getFieldIcon = (key: string) => {
    if (key.includes('food')) return <Utensils className="h-4 w-4 text-[var(--accent-warm)]" />;
    if (key.includes('time') || key.includes('days'))
      return <Calendar className="h-4 w-4 text-[var(--accent-cyan)]" />;
    if (key.includes('tip')) return <Lightbulb className="h-4 w-4 text-[var(--accent-warm)]" />;
    if (key.includes('budget')) return <Wallet className="h-4 w-4 text-[var(--accent-primary)]" />;
    return <MapPin className="h-4 w-4 text-[var(--accent-primary)]" />;
  };

  // Feedback #13: Remove "name" row inside the About this place box (shown in header instead)
  const displayEntries = Object.entries(activeData).filter(
    ([key]) => key.toLowerCase() !== 'name',
  );

  const displayName = formatFieldValue(activeData.name ?? selectedSample?.data.name ?? '');

  return (
    <div className="space-y-6">
      {/* Feedback #14: Popular Destinations Header + Language Selector (no subtitle or Explore label) */}
      <section className="wl-folio overflow-visible p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-tl-md rounded-tr-2xl rounded-br-md rounded-bl-2xl bg-[var(--accent-soft)] text-[var(--accent-primary)]"
            >
              <Compass className="h-6 w-6" />
            </div>
            <h2 className="font-heading text-2xl font-extrabold text-[var(--text-primary)]">
              {t('destHeaderTitle')}
            </h2>
          </div>

          <div className="w-full sm:w-80">
            <LanguageCombobox
              label={t('destinationLanguageLabel')}
              value={targetLang}
              onChange={setTargetLang}
              travelLanguages={travelLanguages}
              allLanguages={allLanguages}
            />
          </div>
        </div>

        {/* Curated Destination Pills */}
        <div className="mt-5 flex flex-wrap gap-2.5">
          {destinations.map((dest) => {
            const active = dest.id === selectedId;
            return (
              <button
                key={dest.id}
                type="button"
                onClick={() => setSelectedId(dest.id)}
                aria-pressed={active}
                className={`flex min-h-[44px] items-center gap-2 rounded-tl-md rounded-tr-2xl rounded-br-md rounded-bl-2xl border px-4 py-2 text-sm font-bold transition sm:text-base ${
                  active
                    ? 'wl-btn-primary border-transparent shadow-sm'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{String(dest.data.name)}</span>
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
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
      </section>

      {/* Feedback #13: Single In-Place "About this place" Guide Sheet */}
      {selectedSample && (
        <section className="wl-folio overflow-hidden">
          <div className="p-5 sm:p-7">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--accent-cyan)]">
                  {t('aboutPlaceTitle')}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2.5">
                  <h3 className="font-heading text-2xl font-extrabold text-[var(--text-primary)] sm:text-3xl">
                    {displayName}
                  </h3>
                  <span className="rounded-md bg-[var(--accent-warm-soft)] px-3 py-1 text-xs font-bold text-[var(--accent-warm)]">
                    {selectedSample.badge}
                  </span>
                </div>
              </div>

              {isTranslating ? (
                <span className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent-soft)] px-3.5 py-1.5 text-xs font-bold text-[var(--accent-primary)]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  {t('translatingBtn')}
                </span>
              ) : (
                translationResult &&
                targetLang !== 'en' && (
                  <span className="rounded-lg bg-[var(--accent-cyan-soft)] px-3.5 py-1.5 font-mono text-xs font-bold text-[var(--accent-cyan)]">
                    {translationResult.target_language_name} ({translationResult.target_language}) ·{' '}
                    {translationResult.latency_ms} ms
                  </span>
                )
              )}
            </div>

            <div
              className={`grid grid-cols-1 gap-4 transition-opacity md:grid-cols-2 ${
                isTranslating ? 'opacity-65' : 'opacity-100'
              }`}
            >
              {displayEntries.map(([key, val]) => {
                const isWide = key === 'description' || key === 'local_tip';
                const isTip = key === 'local_tip';
                return (
                  <div
                    key={key}
                    className={`${isWide ? 'md:col-span-2' : ''} ${
                      isTip
                        ? 'rounded-tl-md rounded-tr-2xl rounded-br-md rounded-bl-2xl border-l-4 border-[var(--accent-warm)] bg-[var(--accent-warm-soft)]/70 p-4 sm:p-5'
                        : 'wl-well p-4 sm:p-5'
                    }`}
                  >
                    <div className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      {getFieldIcon(key)}
                      <span>{formatFieldLabel(key)}</span>
                    </div>
                    <div className="text-base font-medium leading-relaxed text-[var(--text-primary)] sm:text-lg">
                      {formatFieldValue(val)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
