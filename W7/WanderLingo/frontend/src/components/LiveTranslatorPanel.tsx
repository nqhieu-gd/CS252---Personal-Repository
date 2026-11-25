import React, { useState } from 'react';
import {
  ArrowLeftRight,
  Bookmark,
  BookOpen,
  Check,
  Clock,
  Copy,
  Download,
  Expand,
  Globe2,
  History,
  RefreshCw,
  Sparkles,
  Trash2,
  Volume2,
  Wand2,
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
import { ModalDialog } from './ModalDialog';
import { MultiCompareModal } from './MultiCompareModal';

interface LiveTranslatorPanelProps {
  travelLanguages: LanguageItem[];
  allLanguages: LanguageItem[];
  phrasebook: PhrasebookCategory[];
  servicePreset: ServicePresetKey;
  history: TranslationHistoryEntry[];
  favorites: TranslationHistoryEntry[];
  isFavorite: (origin: string, dest: string) => boolean;
  onToggleFavorite: (entry: Omit<TranslationHistoryEntry, 'id' | 'timestampIso'>) => void;
  onClearFavorites: () => void;
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
  favorites,
  isFavorite,
  onToggleFavorite,
  onClearFavorites,
  onAddHistory,
  onClearHistory,
  onError,
  onOperationComplete,
}) => {
  const { locale, t } = useI18n();
  const [inputText, setInputText] = useState('Hpw do I reverve a room?');
  const [srcLang, setSrcLang] = useState('auto');
  const [destLang, setDestLang] = useState('vi');
  const [activeCategory, setActiveCategory] = useState<string>('hotel');
  const [libraryTab, setLibraryTab] = useState<'history' | 'favorites'>('history');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<TranslateResponse | null>(null);
  const [backTranslation, setBackTranslation] = useState<string | null>(null);
  const [detectionOnly, setDetectionOnly] = useState<DetectResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [showCardOpen, setShowCardOpen] = useState(false);
  const [multiModalOpen, setMultiModalOpen] = useState(false);

  const runTranslate = async (
    textOverride?: string,
    srcOverride?: string,
    destOverride?: string,
  ) => {
    const textToUse = (textOverride ?? inputText).trim();
    if (!textToUse) return;
    onError(null);
    setIsTranslating(true);
    setDetectionOnly(null);
    setBackTranslation(null);

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

  const runVerifyBackTranslation = async () => {
    if (!result || !result.text.trim()) return;
    setIsVerifying(true);
    try {
      const back = await apiClient.translateText({
        text: result.text,
        src: result.dest,
        dest: result.src,
        servicePreset,
      });
      setBackTranslation(back.text);
      onOperationComplete();
    } catch {
      // ignore non-critical round-trip error
    } finally {
      setIsVerifying(false);
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

  const handleExportPhraseSheet = () => {
    const sourceList = favorites.length > 0 ? favorites : history;
    if (sourceList.length === 0) return;
    const lines = [
      'WanderLingo — Personal Travel Phrase Sheet',
      '==========================================',
      '',
      ...sourceList.map(
        (item, idx) =>
          `${idx + 1}. [${item.srcName} -> ${item.destName}]\n   Source: ${item.origin}\n   Translation: ${item.translated}${
            item.pronunciation ? `\n   Pronunciation: ${item.pronunciation}` : ''
          }\n`,
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'WanderLingo_Travel_Phrase_Sheet.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentPhraseCategory =
    phrasebook.find((c) => c.category === activeCategory) ?? phrasebook[0];

  const activeLibraryList = libraryTab === 'favorites' ? favorites : history;
  const savedNow = result ? isFavorite(result.origin, result.dest) : false;

  return (
    <div className="space-y-6">
      {/* Unified Sculpted Split-Deck Travel Translator Card */}
      <section className="wl-card overflow-visible p-5 sm:p-6">
        {/* Top Integrated Language Selector & Multi-Broadcast Bar */}
        <div className="flex flex-col gap-4 border-b border-[var(--border-subtle)] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
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
              className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] text-[var(--text-primary)] shadow-2xs transition hover:border-[var(--accent-primary)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-primary)]"
            >
              <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
            </button>

            <LanguageCombobox
              label={t('targetLanguage')}
              value={destLang}
              onChange={setDestLang}
              travelLanguages={travelLanguages}
              allLanguages={allLanguages}
            />
          </div>

          <button
            type="button"
            onClick={() => setMultiModalOpen(true)}
            className="flex min-h-[46px] shrink-0 items-center justify-center gap-2 rounded-full border border-[var(--accent-warm)]/35 bg-[var(--accent-warm-soft)] px-4 py-2.5 text-sm font-bold text-[var(--accent-warm)] transition hover:bg-[var(--accent-warm)] hover:text-white"
          >
            <Globe2 className="h-4 w-4" aria-hidden="true" />
            <span>{t('multiCompareBtn')}</span>
          </button>
        </div>

        {/* Split Source & Target Wells */}
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Left Well: Input + Typo/Grammar Suggestion */}
          <div className="flex flex-col justify-between gap-3">
            <div>
              <div className="wl-well p-4 transition focus-within:border-[var(--accent-primary)]">
                <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  <span>{t('sourceLanguage')}</span>
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
                  className="w-full resize-none bg-transparent text-base leading-relaxed text-[var(--text-primary)] outline-none sm:text-lg"
                />
              </div>

              {/* Grammar & Spelling Fixing Recommendation Banner ("Did you mean: ...") */}
              {result?.did_you_mean && (
                <div
                  role="status"
                  aria-live="polite"
                  className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--accent-warm)]/45 bg-[var(--accent-warm-soft)] px-4 py-3 text-sm shadow-2xs"
                >
                  <div className="flex flex-wrap items-center gap-2 text-[var(--text-primary)]">
                    <Wand2
                      className="h-4 w-4 shrink-0 text-[var(--accent-warm)]"
                      aria-hidden="true"
                    />
                    <span className="font-medium text-[var(--text-secondary)]">
                      {t('didYouMeanPrefix')}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const corrected = result.did_you_mean!;
                        setInputText(corrected);
                        void runTranslate(corrected);
                      }}
                      className="text-left text-base font-bold text-[var(--text-primary)] underline decoration-[var(--accent-warm)] decoration-2 underline-offset-4 hover:text-[var(--accent-warm)]"
                    >
                      “{result.did_you_mean}”
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const corrected = result.did_you_mean!;
                      setInputText(corrected);
                      void runTranslate(corrected);
                    }}
                    className="min-h-[38px] rounded-full bg-[var(--accent-warm)] px-4 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-[var(--accent-warm-hover)]"
                  >
                    {t('applySuggestionBtn')}
                  </button>
                </div>
              )}

              {/* Standalone Language Detection Result Card */}
              {detectionOnly && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--accent-soft)] px-4 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--accent-primary)]">
                      {t('detectedSourceBadge')}:
                    </span>
                    <span className="font-bold text-[var(--text-primary)]">
                      {detectionOnly.lang_name} ({detectionOnly.lang})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs">
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

            {/* Action Buttons Row */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={isTranslating || !inputText.trim()}
                  onClick={() => void runTranslate()}
                  className="flex min-h-[46px] items-center gap-2 rounded-full bg-[var(--accent-primary)] px-6 py-2.5 text-base font-bold text-white shadow-sm transition hover:bg-[var(--accent-primary-hover)] disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  <span>{isTranslating ? t('translatingBtn') : t('translateNowBtn')}</span>
                </button>

                <button
                  type="button"
                  disabled={isDetecting || !inputText.trim()}
                  onClick={() => void runDetectOnly()}
                  className="flex min-h-[46px] items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--accent-primary)] disabled:opacity-50"
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
                    setBackTranslation(null);
                  }}
                  className="min-h-[42px] rounded-full px-3.5 py-1.5 text-sm font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-surface-muted)] hover:text-[var(--text-primary)]"
                >
                  {t('clearTextBtn')}
                </button>
              )}
            </div>
          </div>

          {/* Right Well: Translated Output + High-Tier Traveler Actions */}
          <div className="flex flex-col justify-between gap-3">
            <div className="wl-well flex flex-1 flex-col justify-between p-4">
              <div>
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      {t('targetLanguage')}
                    </span>
                    {result && (
                      <>
                        <span className="rounded-full bg-[var(--accent-soft)] px-3 py-0.5 font-bold text-[var(--accent-primary)]">
                          {result.src_name} ({result.src}) → {result.dest_name} ({result.dest})
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold ${
                            result.cached
                              ? 'bg-[var(--status-good-bg)] text-[var(--status-good-text)]'
                              : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                          }`}
                        >
                          <Zap className="h-3 w-3" aria-hidden="true" />
                          {result.cached ? t('cachedBadge') : t('liveApiBadge')} ({result.latency_ms} ms)
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="min-h-[138px] py-1 text-base leading-relaxed text-[var(--text-primary)] sm:text-xl">
                  {result ? (
                    <p className="whitespace-pre-wrap font-semibold">{result.text}</p>
                  ) : (
                    <p className="text-base text-[var(--text-muted)] italic">
                      {isTranslating ? t('translatingBtn') : t('inputPlaceholder')}
                    </p>
                  )}
                </div>

                {/* Phonetic Pronunciation Box */}
                {result?.pronunciation && (
                  <div className="mt-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)]">
                      {t('pronunciationLabel')}
                    </div>
                    <div className="mt-1 font-mono text-base text-[var(--text-primary)]">
                      {result.pronunciation}
                    </div>
                  </div>
                )}

                {/* Skipped Notice */}
                {result?.skipped && (
                  <div className="mt-3 rounded-2xl bg-[var(--status-caution-bg)] px-3.5 py-2 text-sm font-semibold text-[var(--status-caution-text)]">
                    {t('skippedSameLangBadge')}
                  </div>
                )}

                {/* Round-Trip Back-Translation Verification Result */}
                {backTranslation && (
                  <div className="mt-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-sm">
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--status-good-text)]">
                      {t('backTranslationLabel')} ({result?.dest_name} → {result?.src_name})
                    </div>
                    <div className="mt-1 font-medium text-[var(--text-primary)]">
                      “{backTranslation}”
                    </div>
                  </div>
                )}
              </div>

              {/* Output Utility Toolbar: Listen, Copy, Save Phrase, Show Card, Verify Meaning */}
              {result && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSpeak(result.text, result.dest)}
                      className="flex min-h-[40px] items-center gap-1.5 rounded-full bg-[var(--bg-surface)] px-3.5 py-1.5 text-sm font-semibold text-[var(--text-primary)] shadow-2xs transition hover:text-[var(--accent-primary)]"
                    >
                      <Volume2 className="h-4 w-4" aria-hidden="true" />
                      <span>{t('speakBtn')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleCopy(result.text)}
                      className="flex min-h-[40px] items-center gap-1.5 rounded-full bg-[var(--bg-surface)] px-3.5 py-1.5 text-sm font-semibold text-[var(--text-primary)] shadow-2xs transition hover:text-[var(--accent-primary)]"
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                          <span>{t('copiedBtn')}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" aria-hidden="true" />
                          <span>{t('copyBtn')}</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onToggleFavorite({
                          origin: result.origin,
                          translated: result.text,
                          src: result.src,
                          srcName: result.src_name,
                          dest: result.dest,
                          destName: result.dest_name,
                          pronunciation: result.pronunciation,
                        })
                      }
                      aria-pressed={savedNow}
                      className={`flex min-h-[40px] items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold shadow-2xs transition ${
                        savedNow
                          ? 'bg-[var(--accent-warm)] text-white'
                          : 'bg-[var(--bg-surface)] text-[var(--text-primary)] hover:text-[var(--accent-warm)]'
                      }`}
                    >
                      <Bookmark className="h-4 w-4" aria-hidden="true" />
                      <span>{savedNow ? t('savedFavoriteBtn') : t('saveFavoriteBtn')}</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {!result.skipped && (
                      <button
                        type="button"
                        disabled={isVerifying}
                        onClick={() => void runVerifyBackTranslation()}
                        className="flex min-h-[40px] items-center gap-1.5 rounded-full bg-[var(--bg-surface)] px-3.5 py-1.5 text-xs font-bold text-[var(--text-secondary)] shadow-2xs transition hover:text-[var(--accent-primary)]"
                      >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>
                          {isVerifying ? t('verifyingMeaningBtn') : t('verifyMeaningBtn')}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowCardOpen(true)}
                      className="flex min-h-[40px] items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3.5 py-1.5 text-sm font-bold text-[var(--accent-primary)] transition hover:bg-[var(--accent-primary)] hover:text-white"
                    >
                      <Expand className="h-4 w-4" aria-hidden="true" />
                      <span>{t('showCardBtn')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Clickable Alternative Phrasings & Dictionary Nuances */}
            {result && (result.alternatives.length > 0 || result.dictionary.length > 0) && (
              <div className="wl-well space-y-3 p-4">
                {result.alternatives.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      {t('alternativesLabel')}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {result.alternatives.map((alt, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setResult((prev) => (prev ? { ...prev, text: alt } : prev))}
                          className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-1.5 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
                        >
                          {alt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {result.dictionary.length > 0 && (
                  <div className="border-t border-[var(--border-subtle)] pt-2.5">
                    <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)]">
                      {t('dictionaryTitle')}
                    </div>
                    <div className="space-y-1.5 text-sm">
                      {result.dictionary.map((entry, idx) => (
                        <div key={idx} className="flex flex-wrap items-baseline gap-2">
                          <span className="rounded-md bg-[var(--accent-soft)] px-2 py-0.5 font-mono text-xs font-bold text-[var(--accent-primary)]">
                            {entry.part_of_speech}
                          </span>
                          <span className="text-[var(--text-secondary)]">
                            {entry.terms.join(' · ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Essential Travel Phrasebook */}
      {phrasebook.length > 0 && (
        <section className="wl-card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                aria-hidden="true"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]"
              >
                <BookOpen className="h-5 w-5" />
              </div>
              <h2 className="font-heading text-lg font-bold text-[var(--text-primary)]">
                {t('phrasebookTitle')}
              </h2>
            </div>

            <div className="flex flex-wrap gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] p-1">
              {phrasebook.map((cat) => (
                <button
                  key={cat.category}
                  type="button"
                  onClick={() => setActiveCategory(cat.category)}
                  className={`min-h-[38px] rounded-full px-4 py-1.5 text-sm font-bold transition ${
                    activeCategory === cat.category
                      ? 'bg-[var(--accent-primary)] text-white shadow-2xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {locale === 'vi' ? cat.label_vi : cat.label_en}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {currentPhraseCategory?.phrases.map((phrase, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setInputText(phrase);
                  void runTranslate(phrase);
                }}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-4 py-2.5 text-left text-base font-medium text-[var(--text-primary)] transition hover:border-[var(--accent-primary)] hover:bg-[var(--accent-soft)]"
              >
                “{phrase}”
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Tabbed Personal Phrase Library: Saved Phrases & Recent History + .txt Export */}
      <section className="wl-card p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] p-1">
            <button
              type="button"
              onClick={() => setLibraryTab('history')}
              className={`flex min-h-[38px] items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold transition ${
                libraryTab === 'history'
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <History className="h-4 w-4" aria-hidden="true" />
              <span>
                {t('historyTab')} ({history.length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setLibraryTab('favorites')}
              className={`flex min-h-[38px] items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold transition ${
                libraryTab === 'favorites'
                  ? 'bg-[var(--accent-warm)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Bookmark className="h-4 w-4" aria-hidden="true" />
              <span>
                {t('favoritesTab')} ({favorites.length})
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(favorites.length > 0 || history.length > 0) && (
              <button
                type="button"
                onClick={handleExportPhraseSheet}
                className="flex min-h-[40px] items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-4 py-1.5 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--accent-primary)]"
              >
                <Download className="h-4 w-4 text-[var(--accent-primary)]" aria-hidden="true" />
                <span>{t('exportSheetBtn')}</span>
              </button>
            )}

            {activeLibraryList.length > 0 && (
              <button
                type="button"
                onClick={libraryTab === 'favorites' ? onClearFavorites : onClearHistory}
                className="flex min-h-[40px] items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold text-[var(--status-warning-text)] hover:bg-[var(--status-warning-bg)]"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                <span>{t('clearHistoryBtn')}</span>
              </button>
            )}
          </div>
        </div>

        {activeLibraryList.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            {libraryTab === 'favorites' ? t('favoritesEmpty') : t('historyEmpty')}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeLibraryList.slice(0, 9).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setInputText(item.origin);
                  setDestLang(item.dest);
                  void runTranslate(item.origin, 'auto', item.dest);
                }}
                className="wl-well flex flex-col justify-between p-4 text-left text-sm transition hover:border-[var(--accent-primary)]"
              >
                <div>
                  <div className="mb-1.5 flex items-center justify-between font-mono text-xs text-[var(--accent-primary)]">
                    <span className="font-semibold">
                      {item.srcName} → {item.destName}
                    </span>
                    <span className="flex items-center gap-1 text-[var(--text-muted)]">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      {new Date(item.timestampIso).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="line-clamp-1 font-medium text-[var(--text-secondary)]">
                    {item.origin}
                  </p>
                  <p className="mt-1 line-clamp-2 text-base font-bold text-[var(--text-primary)]">
                    {item.translated}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Sculpted Show-to-Local Conversation Flashcard Dialog */}
      <ModalDialog
        open={showCardOpen && Boolean(result)}
        onClose={() => setShowCardOpen(false)}
        title={t('showCardDialogTitle')}
        subtitle={t('showCardDialogHint')}
        icon={<Expand className="h-5 w-5" />}
        maxWidthClass="max-w-2xl"
      >
        {result && (
          <div className="space-y-6 text-center">
            <div className="wl-well p-6 sm:p-8">
              <div className="mb-3 inline-flex rounded-full bg-[var(--accent-soft)] px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)]">
                {result.dest_name} ({result.dest})
              </div>
              <p className="font-heading text-2xl font-extrabold leading-snug text-[var(--text-primary)] sm:text-4xl">
                {result.text}
              </p>
              {result.pronunciation && (
                <p className="mt-4 font-mono text-lg font-medium text-[var(--accent-primary)]">
                  {result.pronunciation}
                </p>
              )}
              <p className="mt-5 border-t border-[var(--border-subtle)] pt-4 text-sm text-[var(--text-secondary)]">
                {result.origin}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => handleSpeak(result.text, result.dest)}
                className="flex min-h-[48px] items-center gap-2 rounded-full bg-[var(--accent-primary)] px-6 py-3 text-base font-bold text-white shadow-sm transition hover:bg-[var(--accent-primary-hover)]"
              >
                <Volume2 className="h-5 w-5" aria-hidden="true" />
                <span>{t('speakBtn')}</span>
              </button>

              <button
                type="button"
                onClick={() => void handleCopy(result.text)}
                className="flex min-h-[48px] items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-6 py-3 text-base font-bold text-[var(--text-primary)] transition hover:border-[var(--accent-primary)]"
              >
                <Copy className="h-5 w-5" aria-hidden="true" />
                <span>{copied ? t('copiedBtn') : t('copyBtn')}</span>
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* Multi-Language Travel Broadcast Dialog */}
      <MultiCompareModal
        open={multiModalOpen}
        onClose={() => setMultiModalOpen(false)}
        initialText={inputText}
        travelLanguages={travelLanguages}
        servicePreset={servicePreset}
        onOperationComplete={onOperationComplete}
      />
    </div>
  );
};
