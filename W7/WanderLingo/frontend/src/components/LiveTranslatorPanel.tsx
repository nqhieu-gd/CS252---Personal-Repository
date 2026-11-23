import React, { useState } from 'react';
import {
  ArrowLeftRight,
  BookOpen,
  Check,
  Clock,
  Copy,
  History,
  Sparkles,
  Trash2,
  Volume2,
  Zap,
} from 'lucide-react';
import { MAX_TEXT_LENGTH } from '../config/apiConfig';
import { useI18n } from '../i18n/I18nContext';
import { apiClient, ApiClientError } from '../services/apiClient';
import type {
  DetectResponse,
  LanguageItem,
  PhrasebookCategory,
  ServicePresetKey,
  TranslateResponse,
  TranslationHistoryEntry,
} from '../types/translate';
import { LanguageCombobox } from './LanguageCombobox';

interface LiveTranslatorPanelProps {
  travelLanguages: LanguageItem[];
  allLanguages: LanguageItem[];
  phrasebook: PhrasebookCategory[];
  servicePreset: ServicePresetKey;
  history: TranslationHistoryEntry[];
  onAddHistory: (entry: Omit<TranslationHistoryEntry, 'id' | 'timestampIso'>) => void;
  onClearHistory: () => void;
  onError: (msg: string | null) => void;
  onOperationComplete: () => void;
}

export const LiveTranslatorPanel: React.FC<LiveTranslatorPanelProps> = ({
  travelLanguages,
  allLanguages,
  phrasebook,
  servicePreset,
  history,
  onAddHistory,
  onClearHistory,
  onError,
  onOperationComplete,
}) => {
  const { locale, t } = useI18n();
  const [inputText, setInputText] = useState('Hello, how are you?');
  const [srcLang, setSrcLang] = useState('auto');
  const [destLang, setDestLang] = useState('vi');
  const [activeCategory, setActiveCategory] = useState<string>('hotel');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [result, setResult] = useState<TranslateResponse | null>(null);
  const [detectionOnly, setDetectionOnly] = useState<DetectResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const runTranslate = async (textOverride?: string, srcOverride?: string, destOverride?: string) => {
    const textToUse = (textOverride ?? inputText).trim();
    if (!textToUse) return;
    onError(null);
    setIsTranslating(true);
    setDetectionOnly(null);

    try {
      const res = await apiClient.translateText({
        text: textToUse,
        src: srcOverride ?? srcLang,
        dest: destOverride ?? destLang,
        servicePreset,
      });
      setResult(res);
      onAddHistory({
        origin: res.origin,
        translated: res.text,
        src: res.src,
        srcName: res.src_name,
        dest: res.dest,
        destName: res.dest_name,
        pronunciation: res.pronunciation,
      });
      onOperationComplete();
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? `${err.message} (${err.code})`
          : 'Failed to translate text.';
      onError(msg);
    } finally {
      setIsTranslating(false);
    }
  };

  const runDetectOnly = async () => {
    const cleaned = inputText.trim();
    if (!cleaned) return;
    onError(null);
    setIsDetecting(true);

    try {
      const det = await apiClient.detectLanguage(cleaned, servicePreset);
      setDetectionOnly(det);
      onOperationComplete();
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? `${err.message} (${err.code})`
          : 'Failed to detect language.';
      onError(msg);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleSwapLanguages = () => {
    const fallbackSrc = destLang === 'en' ? 'vi' : 'en';
    const effectiveSrc = srcLang === 'auto' ? (result?.src ?? fallbackSrc) : srcLang;
    const nextSrc = destLang;
    const nextDest = effectiveSrc === destLang ? fallbackSrc : effectiveSrc;
    setSrcLang(nextSrc);
    setDestLang(nextDest);
    if (result?.text) {
      setInputText(result.text);
      void runTranslate(result.text, nextSrc, nextDest);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard permissions error
    }
  };

  const handleSpeak = (text: string, langCode: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = langCode;
      window.speechSynthesis.speak(utterance);
    }
  };

  const currentPhraseCategory =
    phrasebook.find((c) => c.category === activeCategory) ?? phrasebook[0];

  return (
    <div className="space-y-6">
      {/* Language Selector Bar */}
      <div className="grid grid-cols-1 items-end gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-xs sm:grid-cols-[1fr_auto_1fr]">
        <LanguageCombobox
          label={t('sourceLanguage')}
          value={srcLang}
          onChange={setSrcLang}
          travelLanguages={travelLanguages}
          allLanguages={allLanguages}
          includeAuto
        />

        <button
          type="button"
          onClick={handleSwapLanguages}
          title={t('swapLanguages')}
          aria-label={t('swapLanguages')}
          className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] text-[var(--text-primary)] transition hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
        >
          <ArrowLeftRight className="h-4 w-4" />
        </button>

        <LanguageCombobox
          label={t('targetLanguage')}
          value={destLang}
          onChange={setDestLang}
          travelLanguages={travelLanguages}
          allLanguages={allLanguages}
        />
      </div>

      {/* Two-Column Source & Output Panes */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Source Text Pane */}
        <div className="flex flex-col justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-xs">
          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span className="font-semibold uppercase tracking-wider">
                {t('sourceLanguage')}
              </span>
              <span className="font-mono">
                {inputText.length} / {MAX_TEXT_LENGTH}
              </span>
            </div>
            <textarea
              rows={6}
              maxLength={MAX_TEXT_LENGTH}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={t('inputPlaceholder')}
              className="w-full resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] p-3.5 text-sm leading-relaxed text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] sm:text-base"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isTranslating || !inputText.trim()}
                onClick={() => void runTranslate()}
                className="flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[var(--accent-primary-hover)] disabled:opacity-50 sm:text-sm"
              >
                <Sparkles className="h-4 w-4" />
                <span>{isTranslating ? t('translatingBtn') : t('translateNowBtn')}</span>
              </button>

              <button
                type="button"
                disabled={isDetecting || !inputText.trim()}
                onClick={() => void runDetectOnly()}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-3.5 py-2.5 text-xs font-semibold text-[var(--text-primary)] transition hover:border-[var(--accent-primary)] disabled:opacity-50 sm:text-sm"
              >
                <span>{isDetecting ? t('detectingBtn') : t('detectOnlyBtn')}</span>
              </button>
            </div>

            {inputText && (
              <button
                type="button"
                onClick={() => {
                  setInputText('');
                  setResult(null);
                  setDetectionOnly(null);
                }}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-surface-muted)] hover:text-[var(--text-primary)]"
              >
                {t('clearTextBtn')}
              </button>
            )}
          </div>

          {/* Standalone Language Detection Result Card (Tutorial Sec. 4) */}
          {detectionOnly && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--accent-soft)] px-3.5 py-2.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[var(--accent-primary)]">
                  {t('detectedSourceBadge')}:
                </span>
                <span className="font-bold text-[var(--text-primary)]">
                  {detectionOnly.lang_name} ({detectionOnly.lang})
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span>
                  {t('confidenceBadge')}:{' '}
                  <strong>
                    {detectionOnly.confidence !== null
                      ? `${Math.round(detectionOnly.confidence * 100)}%`
                      : 'N/A'}
                  </strong>
                </span>
                <span>·</span>
                <span>{detectionOnly.latency_ms} ms</span>
              </div>
            </div>
          )}
        </div>

        {/* Target Output Pane */}
        <div className="flex flex-col justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-xs">
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {t('targetLanguage')}
                </span>
                {result && (
                  <>
                    <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 font-semibold text-[var(--accent-primary)]">
                      {result.src_name} ({result.src}) → {result.dest_name} ({result.dest})
                    </span>
                    <span
                      className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                        result.cached
                          ? 'bg-[var(--status-good-bg)] text-[var(--status-good-text)]'
                          : 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)]'
                      }`}
                    >
                      <Zap className="h-3 w-3" />
                      {result.cached ? t('cachedBadge') : t('liveApiBadge')} ({result.latency_ms} ms)
                    </span>
                  </>
                )}
              </div>

              {result && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSpeak(result.text, result.dest)}
                    className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                    <span>{t('speakBtn')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopy(result.text)}
                    className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        <span>{t('copiedBtn')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>{t('copyBtn')}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            <div className="min-h-[156px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] p-3.5 text-sm leading-relaxed text-[var(--text-primary)] sm:text-base">
              {result ? (
                <p className="whitespace-pre-wrap font-medium">{result.text}</p>
              ) : (
                <p className="text-[var(--text-muted)] italic">
                  {isTranslating ? t('translatingBtn') : t('inputPlaceholder')}
                </p>
              )}
            </div>
          </div>

          {/* Pronunciation / Romanization & Skipped Badges */}
          <div className="mt-3 space-y-2">
            {result?.skipped && (
              <div className="rounded-xl bg-[var(--status-caution-bg)] px-3 py-2 text-xs font-semibold text-[var(--status-caution-text)]">
                {t('skippedSameLangBadge')}
              </div>
            )}

            {result?.pronunciation && (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-3.5 py-2.5 text-xs">
                <div className="font-semibold uppercase tracking-wider text-[var(--accent-primary)]">
                  {t('pronunciationLabel')}
                </div>
                <div className="mt-0.5 font-mono text-sm text-[var(--text-primary)]">
                  {result.pronunciation}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Travel Phrasebook Chips */}
      {phrasebook.length > 0 && (
        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-xs">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
              <BookOpen className="h-4 w-4 text-[var(--accent-primary)]" />
              <span>{t('phrasebookTitle')}</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {phrasebook.map((cat) => (
                <button
                  key={cat.category}
                  type="button"
                  onClick={() => setActiveCategory(cat.category)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    activeCategory === cat.category
                      ? 'bg-[var(--accent-primary)] text-white'
                      : 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {locale === 'vi' ? cat.label_vi : cat.label_en}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {currentPhraseCategory?.phrases.map((phrase, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setInputText(phrase);
                  void runTranslate(phrase);
                }}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-3 py-2 text-left text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--accent-primary)] hover:bg-[var(--accent-soft)]"
              >
                “{phrase}”
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Local Session Translation History */}
      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-xs">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
            <History className="h-4 w-4 text-[var(--accent-primary)]" />
            <span>
              {t('historyTitle')} ({history.length})
            </span>
          </div>
          {history.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-[var(--status-warning-bg)]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{t('clearHistoryBtn')}</span>
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">{t('historyEmpty')}</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {history.slice(0, 6).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setInputText(item.origin);
                  setDestLang(item.dest);
                  void runTranslate(item.origin, 'auto', item.dest);
                }}
                className="flex flex-col justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] p-3 text-left text-xs transition hover:border-[var(--accent-primary)]"
              >
                <div>
                  <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-[var(--accent-primary)]">
                    <span>
                      {item.srcName} → {item.destName}
                    </span>
                    <span className="flex items-center gap-1 text-[var(--text-muted)]">
                      <Clock className="h-3 w-3" />
                      {new Date(item.timestampIso).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="line-clamp-1 font-medium text-[var(--text-secondary)]">
                    {item.origin}
                  </p>
                  <p className="mt-0.5 line-clamp-1 font-bold text-[var(--text-primary)]">
                    {item.translated}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
