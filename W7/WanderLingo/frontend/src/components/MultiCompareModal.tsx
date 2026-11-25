import React, { useState } from 'react';
import { Check, Copy, Globe2, Sparkles, Volume2, Wand2 } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { apiClient, ApiClientError } from '../services/apiClient';
import type {
  LanguageItem,
  MultiTargetTranslateResponse,
  ServicePresetKey,
} from '../types/translate';
import { ModalDialog } from './ModalDialog';

interface MultiCompareModalProps {
  open: boolean;
  onClose: () => void;
  initialText: string;
  travelLanguages: LanguageItem[];
  servicePreset: ServicePresetKey;
  onOperationComplete: () => void;
}

export const MultiCompareModal: React.FC<MultiCompareModalProps> = ({
  open,
  onClose,
  initialText,
  travelLanguages,
  servicePreset,
  onOperationComplete,
}) => {
  const { t } = useI18n();
  const [text, setText] = useState(initialText || 'Welcome to our hotel! Breakfast is served from 6:30 AM to 10:00 AM.');
  const [selectedTargets, setSelectedTargets] = useState<string[]>(['vi', 'ja', 'ko', 'zh-cn', 'fr']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<MultiTargetTranslateResponse | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const toggleTarget = (code: string) => {
    setSelectedTargets((prev) => {
      if (prev.includes(code)) {
        return prev.length > 1 ? prev.filter((c) => c !== code) : prev;
      }
      return prev.length < 5 ? [...prev, code] : prev;
    });
  };

  const runBroadcast = async (textOverride?: string) => {
    const cleaned = (textOverride ?? text).trim();
    if (!cleaned || selectedTargets.length === 0) return;
    setError(null);
    setLoading(true);
    try {
      const res = await apiClient.translateMultiTarget({
        text: cleaned,
        src: 'auto',
        targets: selectedTargets,
        servicePreset,
      });
      setResponse(res);
      onOperationComplete();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? `${err.message} (${err.code})`
          : 'Failed to run multi-language broadcast.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAll = async () => {
    if (!response) return;
    const formatted = response.results
      .filter((r) => r.text)
      .map(
        (r) =>
          `[${r.dest_name} (${r.dest})]\n${r.text}${
            r.pronunciation ? `\n(${r.pronunciation})` : ''
          }`,
      )
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(formatted);
      setCopiedAll(true);
      window.setTimeout(() => setCopiedAll(false), 1800);
    } catch {
      // ignore
    }
  };

  const speak = (utterText: string, lang: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(utterText);
      u.lang = lang;
      window.speechSynthesis.speak(u);
    }
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title={t('multiCompareTitle')}
      subtitle={t('multiCompareSubtitle')}
      icon={<Globe2 className="h-5 w-5" />}
      maxWidthClass="max-w-3xl"
    >
      <div className="space-y-5">
        <div>
          <textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('inputPlaceholder')}
            className="wl-well w-full resize-none p-4 text-base text-[var(--text-primary)]"
          />

          {response?.did_you_mean && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--accent-warm)]/40 bg-[var(--accent-warm-soft)] px-4 py-3 text-sm">
              <div className="flex items-center gap-2 text-[var(--text-primary)]">
                <Wand2 className="h-4 w-4 shrink-0 text-[var(--accent-warm)]" aria-hidden="true" />
                <span>{t('didYouMeanPrefix')}</span>
                <strong className="font-semibold underline decoration-[var(--accent-warm)] decoration-2 underline-offset-4">
                  {response.did_you_mean}
                </strong>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = response.did_you_mean!;
                  setText(next);
                  void runBroadcast(next);
                }}
                className="rounded-full bg-[var(--accent-warm)] px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-[var(--accent-warm-hover)]"
              >
                {t('applySuggestionBtn')}
              </button>
            </div>
          )}
        </div>

        {/* Language Toggle Pills (Up to 5) */}
        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {t('pinnedTravelLanguages')} ({selectedTargets.length}/5)
          </div>
          <div className="flex flex-wrap gap-2">
            {travelLanguages.map((lang) => {
              const active = selectedTargets.includes(lang.code);
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => toggleTarget(lang.code)}
                  aria-pressed={active}
                  className={`min-h-[42px] rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white shadow-xs'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {lang.name} ({lang.code})
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={loading || !text.trim()}
            onClick={() => void runBroadcast()}
            className="flex min-h-[46px] items-center gap-2 rounded-full bg-[var(--accent-primary)] px-6 py-2.5 text-base font-semibold text-white shadow-sm transition hover:bg-[var(--accent-primary-hover)] disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span>{loading ? t('translatingBtn') : t('multiCompareRunBtn')}</span>
          </button>

          {response && (
            <button
              type="button"
              onClick={() => void handleCopyAll()}
              className="flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--accent-primary)]"
            >
              {copiedAll ? (
                <>
                  <Check className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                  <span>{t('copiedBtn')}</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  <span>{t('multiCompareCopyAllBtn')}</span>
                </>
              )}
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-2xl bg-[var(--status-warning-bg)] px-4 py-3 text-sm font-medium text-[var(--status-warning-text)]">
            {error}
          </div>
        )}

        {response && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {response.results.map((item) => (
              <div key={item.dest} className="wl-well flex flex-col justify-between p-4">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="rounded-full bg-[var(--accent-soft)] px-3 py-0.5 text-xs font-bold text-[var(--accent-primary)]">
                      {item.dest_name} ({item.dest})
                    </span>
                    {item.text && (
                      <button
                        type="button"
                        onClick={() => speak(item.text!, item.dest)}
                        aria-label={`${t('speakBtn')} ${item.dest_name}`}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)]"
                      >
                        <Volume2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  {item.error ? (
                    <p className="text-sm text-[var(--status-warning-text)]">{item.error}</p>
                  ) : (
                    <>
                      <p className="text-base font-semibold leading-relaxed text-[var(--text-primary)]">
                        {item.text}
                      </p>
                      {item.pronunciation && (
                        <p className="mt-1.5 font-mono text-xs text-[var(--text-secondary)]">
                          {item.pronunciation}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalDialog>
  );
};
