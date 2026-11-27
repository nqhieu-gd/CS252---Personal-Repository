import React, { useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Bookmark,
  BookOpen,
  Check,
  Clock,
  Copy,
  Download,
  Expand,
  History,
  RefreshCw,
  Sparkles,
  Trash2,
  Volume2,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { MAX_TEXT_LENGTH } from '../config/apiConfig';
import { useI18n } from '../i18n/I18nContext';
import { apiClient, ApiClientError } from '../services/apiClient';
import type {
  LanguageItem,
  PhrasebookCategory,
  ServicePresetKey,
  TranslateResponse,
  TranslationHistoryEntry,
} from '../types/translate';
import { LanguageCombobox } from './LanguageCombobox';
import { ModalDialog } from './ModalDialog';

interface LiveTranslatorPanelProps {
  travelLanguages: LanguageItem[];
  allLanguages: LanguageItem[];
  phrasebook: PhrasebookCategory[];
  servicePreset: ServicePresetKey;
  history: TranslationHistoryEntry[];
  favorites: TranslationHistoryEntry[];
  isFavorite: (origin: string, dest: string) => boolean;
  onToggleFavorite: (entry: Omit<TranslationHistoryEntry, 'id' | 'timestampIso'>) => void;
  onRemoveFavorite: (id: string) => void;
  onClearFavorites: () => void;
  onAddHistory: (entry: Omit<TranslationHistoryEntry, 'id' | 'timestampIso'>) => void;
  onClearHistory: () => void;
  onError: (msg: string | null) => void;
  onOperationComplete: () => void;
}

const QUICK_SRC_CHIPS = ['auto', 'en', 'vi', 'ja', 'ko'];
const QUICK_DEST_CHIPS = ['vi', 'en', 'ja', 'ko', 'fr'];
const TICKET_ACCENTS = [
  'var(--line-accent-1)',
  'var(--line-accent-2)',
  'var(--line-accent-3)',
];

export const LiveTranslatorPanel: React.FC<LiveTranslatorPanelProps> = ({
  travelLanguages,
  allLanguages,
  phrasebook,
  servicePreset,
  history,
  favorites,
  isFavorite,
  onToggleFavorite,
  onRemoveFavorite,
  onClearFavorites,
  onAddHistory,
  onClearHistory,
  onError,
  onOperationComplete,
}) => {
  const { locale, t } = useI18n();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [inputText, setInputText] = useState('');
  const [srcLang, setSrcLang] = useState('auto');
  const [destLang, setDestLang] = useState('vi');
  const [activeCategory, setActiveCategory] = useState<string>('hotel');
  const [libraryTab, setLibraryTab] = useState<'history' | 'favorites'>('history');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<TranslateResponse | null>(null);
  const [backTranslation, setBackTranslation] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showCardOpen, setShowCardOpen] = useState(false);

  const runTranslate = async (
    textOverride?: string,
    srcOverride?: string,
    destOverride?: string,
  ) => {
    const textToUse = (textOverride ?? inputText).trim();
    if (!textToUse) return;
    onError(null);
    setIsTranslating(true);
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

  const handleSelectPhrasebookItem = (phrase: string) => {
    setInputText(phrase);
    const blankIdx = phrase.indexOf('...');
    if (blankIdx !== -1) {
      window.setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(blankIdx, blankIdx + 3);
        }
      }, 20);
    }
    void runTranslate(phrase);
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
    if (favorites.length === 0) return;
    const lines = [
      'WanderLingo — Saved Travel Phrase Sheet',
      '=======================================',
      '',
      ...favorites.map(
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
    a.download = 'WanderLingo_Saved_Phrases.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getShortLangLabel = (code: string) => {
    if (code === 'auto') return 'Auto';
    const found =
      travelLanguages.find((l) => l.code === code) ??
      allLanguages.find((l) => l.code === code);
    return found ? found.name.split(' ')[0] : code.toUpperCase();
  };

  const currentPhraseCategory =
    phrasebook.find((c) => c.category === activeCategory) ?? phrasebook[0];

  const activeLibraryList = libraryTab === 'favorites' ? favorites : history;
  const savedNow = result ? isFavorite(result.origin, result.dest) : false;

  return (
    <div className="space-y-6">
      {/* Architectural Two-Leaf Travel Folio (Wrapped Top-Arch Gradient Frame) */}
      <section className="wl-folio overflow-visible">
        {/* Folio Language Routing Cap (Follows Wrapped Top Curve Seamlessly) */}
        <div className="rounded-t-[calc(1.5rem-2.5px)] border-b border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]/80 px-5 py-4 sm:px-6">
          <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_auto_1fr]">
            {/* Source Language Selector + Quick Chips */}
            <div className="space-y-2">
              <LanguageCombobox
                label={t('sourceLanguage')}
                value={srcLang}
                onChange={setSrcLang}
                travelLanguages={travelLanguages}
                allLanguages={allLanguages}
                includeAuto
              />
              <div className="flex flex-wrap gap-1.5">
                {QUICK_SRC_CHIPS.map((code) => {
                  const active = srcLang === code;
                  return (
                    <button
                      key={`src-chip-${code}`}
                      type="button"
                      onClick={() => setSrcLang(code)}
                      className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
                        active
                          ? 'wl-btn-primary shadow-2xs'
                          : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)]'
                      }`}
                    >
                      {getShortLangLabel(code)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Center Swap Medallion */}
            <div className="flex justify-center md:pb-7">
              <button
                type="button"
                onClick={handleSwapLanguages}
                title={t('swapLanguages')}
                aria-label={t('swapLanguages')}
                className="flex h-11 w-11 items-center justify-center rounded-tl-md rounded-tr-2xl rounded-br-md rounded-bl-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--accent-primary)] shadow-xs transition hover:border-[var(--accent-warm)] hover:bg-[var(--accent-warm-soft)] hover:text-[var(--accent-warm)]"
              >
                <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Target Language Selector + Quick Chips */}
            <div className="space-y-2">
              <LanguageCombobox
                label={t('targetLanguage')}
                value={destLang}
                onChange={(code) => {
                  setDestLang(code);
                  if (inputText.trim()) {
                    void runTranslate(inputText, srcLang, code);
                  }
                }}
                travelLanguages={travelLanguages}
                allLanguages={allLanguages}
              />
              <div className="flex flex-wrap gap-1.5">
                {QUICK_DEST_CHIPS.map((code) => {
                  const active = destLang === code;
                  return (
                    <button
                      key={`dest-chip-${code}`}
                      type="button"
                      onClick={() => {
                        setDestLang(code);
                        if (inputText.trim()) {
                          void runTranslate(inputText, srcLang, code);
                        }
                      }}
                      className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
                        active
                          ? 'bg-[var(--accent-cyan)] text-white shadow-2xs'
                          : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--accent-cyan)]'
                      }`}
                    >
                      {getShortLangLabel(code)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Edge-to-Edge Split Folio Leaves: Cream/Charcoal Source Leaf | Spine | Lavender-Tinted Output Leaf */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5px_1fr]">
          {/* LEFT LEAF: Clean Editorial Writing Sheet */}
          <div className="flex flex-col justify-between p-5 sm:p-7">
            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--btn-primary-bg)]" />
                  {srcLang === 'auto' && result
                    ? `${t('detectedSourceBadge')}: ${result.src_name} (${result.src})`
                    : t('sourceLanguage')}
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-[var(--text-muted)]">
                    {inputText.length} / {MAX_TEXT_LENGTH}
                  </span>
                  {inputText && (
                    <button
                      type="button"
                      onClick={() => {
                        setInputText('');
                        setResult(null);
                        setBackTranslation(null);
                      }}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold text-[var(--text-muted)] transition hover:bg-[var(--bg-surface-muted)] hover:text-[var(--accent-warm)]"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('clearTextBtn')}
                    </button>
                  )}
                </div>
              </div>

              <textarea
                ref={textareaRef}
                rows={5}
                maxLength={MAX_TEXT_LENGTH}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    void runTranslate();
                  }
                }}
                placeholder={t('inputPlaceholder')}
                className="w-full resize-none border-0 bg-transparent text-lg leading-relaxed text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]/75 sm:text-xl"
              />

              {/* Vermilion / Rust Grammar & Spelling Fixing Banner ("Did you mean: ...") */}
              {result?.did_you_mean && (
                <div
                  role="status"
                  aria-live="polite"
                  className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-tl-md rounded-tr-2xl rounded-br-md rounded-bl-2xl border-l-4 border-[var(--accent-warm)] bg-[var(--accent-warm-soft)] px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2 text-[var(--text-primary)]">
                    <Wand2
                      className="h-4 w-4 shrink-0 text-[var(--accent-warm)]"
                      aria-hidden="true"
                    />
                    <span className="font-semibold text-[var(--text-secondary)]">
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
                    className="min-h-[36px] rounded-full bg-[var(--accent-warm)] px-4 py-1.5 text-xs font-bold text-white transition hover:bg-[var(--accent-warm-hover)]"
                  >
                    {t('applySuggestionBtn')}
                  </button>
                </div>
              )}
            </div>

            {/* Anchored Source Action Seam */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
              <button
                type="button"
                disabled={isTranslating || !inputText.trim()}
                onClick={() => void runTranslate()}
                className="wl-btn-primary flex min-h-[48px] items-center gap-2.5 rounded-tl-md rounded-tr-2xl rounded-br-md rounded-bl-2xl px-7 py-2.5 text-base font-bold shadow-sm disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span>{isTranslating ? t('translatingBtn') : t('translateNowBtn')}</span>
              </button>

              <span className="hidden font-mono text-xs text-[var(--text-muted)] sm:inline">
                Ctrl + Enter
              </span>
            </div>
          </div>

          {/* CENTER FOLIO SPINE */}
          <div className="h-[1.5px] w-full bg-[var(--border-subtle)] lg:h-auto lg:w-[1.5px]" />

          {/* RIGHT LEAF: Lavender-Tinted Destination Reading Sheet */}
          <div className="flex flex-col justify-between rounded-b-[calc(1.5rem-2.5px)] bg-[var(--bg-surface-tint)]/75 p-5 sm:p-7 lg:rounded-bl-none">
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 font-bold uppercase tracking-wider text-[var(--accent-cyan)]">
                    <span className="h-2 w-2 rounded-full bg-[var(--accent-cyan)]" />
                    {t('targetLanguage')}
                  </span>
                  {result && (
                    <span className="rounded-md bg-[var(--accent-soft)] px-2.5 py-1 font-bold text-[var(--accent-primary)]">
                      {result.src_name} → {result.dest_name}
                    </span>
                  )}
                </div>

                {result && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-mono text-xs font-semibold ${
                      result.cached
                        ? 'bg-[var(--status-good-bg)] text-[var(--status-good-text)]'
                        : 'bg-[var(--accent-cyan-soft)] text-[var(--accent-cyan)]'
                    }`}
                  >
                    <Zap className="h-3 w-3" aria-hidden="true" />
                    {result.cached ? t('cachedBadge') : t('liveApiBadge')} · {result.latency_ms} ms
                  </span>
                )}
              </div>

              <div className="min-h-[132px] py-1 text-lg leading-relaxed text-[var(--text-primary)] sm:text-2xl">
                {result ? (
                  <p className="font-heading whitespace-pre-wrap font-bold tracking-tight">
                    {result.text}
                  </p>
                ) : (
                  <p className="text-base text-[var(--text-muted)] italic">
                    {isTranslating ? t('translatingBtn') : t('outputPlaceholder')}
                  </p>
                )}
              </div>

              {/* Cyan-Accented Phonetic Pronunciation Strip */}
              {result?.pronunciation && (
                <div className="mt-3 rounded-tl-sm rounded-tr-xl rounded-br-xl rounded-bl-sm border-l-4 border-[var(--accent-cyan)] bg-[var(--bg-surface)] px-4 py-2.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-[var(--accent-cyan)]">
                    {t('pronunciationLabel')}
                  </div>
                  <div className="mt-0.5 font-mono text-base text-[var(--text-primary)]">
                    {result.pronunciation}
                  </div>
                </div>
              )}

              {/* Skipped Notice */}
              {result?.skipped && (
                <div className="mt-3 rounded-xl bg-[var(--status-caution-bg)] px-3.5 py-2 text-sm font-semibold text-[var(--status-caution-text)]">
                  {t('skippedSameLangBadge')}
                </div>
              )}

              {/* Round-Trip Back-Translation Verification Strip */}
              {backTranslation && (
                <div className="mt-3 rounded-tl-sm rounded-tr-xl rounded-br-xl rounded-bl-sm border-l-4 border-emerald-500 bg-[var(--bg-surface)] px-4 py-2.5 text-sm">
                  <div className="text-xs font-bold uppercase tracking-wider text-[var(--status-good-text)]">
                    {t('backTranslationLabel')} ({result?.dest_name} → {result?.src_name})
                  </div>
                  <div className="mt-0.5 font-semibold text-[var(--text-primary)]">
                    “{backTranslation}”
                  </div>
                </div>
              )}
            </div>

            {/* Anchored Output Utility Rail */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={!result}
                  onClick={() => result && handleSpeak(result.text, result.dest)}
                  className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--accent-cyan)] hover:text-[var(--accent-cyan)] disabled:opacity-40"
                >
                  <Volume2 className="h-4 w-4" aria-hidden="true" />
                  <span>{t('speakBtn')}</span>
                </button>

                <button
                  type="button"
                  disabled={!result}
                  onClick={() => result && void handleCopy(result.text)}
                  className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] disabled:opacity-40"
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
                  disabled={!result}
                  onClick={() =>
                    result &&
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
                  className={`flex min-h-[40px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition disabled:opacity-40 ${
                    savedNow
                      ? 'border-[var(--accent-warm)] bg-[var(--accent-warm)] text-white'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--accent-warm)] hover:text-[var(--accent-warm)]'
                  }`}
                >
                  <Bookmark className="h-4 w-4" aria-hidden="true" />
                  <span>{savedNow ? t('savedFavoriteBtn') : t('saveFavoriteBtn')}</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {result && !result.skipped && (
                  <button
                    type="button"
                    disabled={isVerifying}
                    onClick={() => void runVerifyBackTranslation()}
                    className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-bold text-[var(--text-secondary)] transition hover:border-[var(--accent-cyan)] hover:text-[var(--accent-cyan)]"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{isVerifying ? t('verifyingMeaningBtn') : t('verifyMeaningBtn')}</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={!result}
                  onClick={() => setShowCardOpen(true)}
                  className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[var(--accent-soft)] px-3.5 py-1.5 text-sm font-bold text-[var(--accent-primary)] transition hover:bg-[var(--btn-primary-bg)] hover:text-white disabled:opacity-40"
                >
                  <Expand className="h-4 w-4" aria-hidden="true" />
                  <span>{t('showCardBtn')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Integrated Folio Margin Band: Alternative Phrasings & Dictionary Nuances */}
        {result && (result.alternatives.length > 0 || result.dictionary.length > 0) && (
          <div className="grid grid-cols-1 gap-5 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] px-5 py-4 sm:px-7 md:grid-cols-2">
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
                      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
                    >
                      {alt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {result.dictionary.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--accent-cyan)]">
                  {t('dictionaryTitle')}
                </div>
                <div className="space-y-1.5 text-sm">
                  {result.dictionary.map((entry, idx) => (
                    <div key={idx} className="flex flex-wrap items-baseline gap-2">
                      <span className="rounded-md bg-[var(--accent-cyan-soft)] px-2 py-0.5 font-mono text-xs font-bold text-[var(--accent-cyan)]">
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
      </section>

      {/* Common English Travel Phrasebook */}
      {phrasebook.length > 0 && (
        <section className="wl-card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <div
                  aria-hidden="true"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent-warm-soft)] text-[var(--accent-warm)]"
                >
                  <BookOpen className="h-5 w-5" />
                </div>
                <h2 className="font-heading text-lg font-bold text-[var(--text-primary)]">
                  {t('phrasebookTitle')}
                </h2>
              </div>
              <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">
                {t('phrasebookBlankHint')}
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] p-1">
              {phrasebook.map((cat) => (
                <button
                  key={cat.category}
                  type="button"
                  onClick={() => setActiveCategory(cat.category)}
                  className={`min-h-[38px] rounded-lg px-3.5 py-1.5 text-sm font-bold transition ${
                    activeCategory === cat.category
                      ? 'wl-btn-primary shadow-2xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {locale === 'vi' ? cat.label_vi : cat.label_en}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {currentPhraseCategory?.phrases.map((phrase, idx) => (
              <button
                key={idx}
                type="button"
                style={{ borderLeftColor: TICKET_ACCENTS[idx % TICKET_ACCENTS.length] }}
                onClick={() => handleSelectPhrasebookItem(phrase)}
                className="wl-phrase-ticket px-4 py-3 text-left text-base font-medium text-[var(--text-primary)]"
              >
                “{phrase}”
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Tabbed Personal Phrase Library: Recent History & Saved Phrases */}
      <section className="wl-card p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] p-1">
            <button
              type="button"
              onClick={() => setLibraryTab('history')}
              className={`flex min-h-[38px] items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-bold transition ${
                libraryTab === 'history'
                  ? 'wl-btn-primary'
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
              className={`flex min-h-[38px] items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-bold transition ${
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
            {/* Feedback #11: Only show Export Phrase Sheet inside Saved Phrases */}
            {libraryTab === 'favorites' && favorites.length > 0 && (
              <button
                type="button"
                onClick={handleExportPhraseSheet}
                className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-4 py-1.5 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--accent-cyan)] hover:text-[var(--accent-cyan)]"
              >
                <Download className="h-4 w-4 text-[var(--accent-cyan)]" aria-hidden="true" />
                <span>{t('exportSheetBtn')}</span>
              </button>
            )}

            {activeLibraryList.length > 0 && (
              <button
                type="button"
                onClick={libraryTab === 'favorites' ? onClearFavorites : onClearHistory}
                className="flex min-h-[40px] items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold text-[var(--status-warning-text)] hover:bg-[var(--status-warning-bg)]"
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
            {activeLibraryList.slice(0, 12).map((item) => (
              <div
                key={item.id}
                className="wl-well group relative flex flex-col justify-between p-4 text-left text-sm transition hover:border-[var(--accent-primary)]"
              >
                <div className="mb-1.5 flex items-center justify-between gap-2 font-mono text-xs text-[var(--accent-primary)]">
                  <span className="font-semibold">
                    {item.srcName} → {item.destName}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-[var(--text-muted)]">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      {new Date(item.timestampIso).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {/* Feedback #12: Delete single saved phrase without deleting others */}
                    {libraryTab === 'favorites' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveFavorite(item.id);
                        }}
                        title={t('removeSavedPhraseAria')}
                        aria-label={t('removeSavedPhraseAria')}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] transition hover:bg-[var(--status-warning-bg)] hover:text-[var(--status-warning-text)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setInputText(item.origin);
                    setDestLang(item.dest);
                    void runTranslate(item.origin, 'auto', item.dest);
                  }}
                  className="w-full text-left"
                >
                  <p className="line-clamp-1 font-medium text-[var(--text-secondary)]">
                    {item.origin}
                  </p>
                  <p className="mt-1 line-clamp-2 text-base font-bold text-[var(--text-primary)]">
                    {item.translated}
                  </p>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Show-to-Local Conversation Flashcard Dialog */}
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
              <div className="mb-3 inline-flex rounded-md bg-[var(--accent-soft)] px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)]">
                {result.dest_name} ({result.dest})
              </div>
              <p className="font-heading text-2xl font-extrabold leading-snug text-[var(--text-primary)] sm:text-4xl">
                {result.text}
              </p>
              {result.pronunciation && (
                <p className="mt-4 font-mono text-lg font-medium text-[var(--accent-cyan)]">
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
                className="wl-btn-primary flex min-h-[48px] items-center gap-2 rounded-full px-6 py-3 text-base font-bold shadow-sm"
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
    </div>
  );
};
