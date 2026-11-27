import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  CornerUpLeft,
  Loader2,
  MessageSquarePlus,
  MessageSquareText,
  Send,
  Sparkles,
  Volume2,
  Wand2,
  X,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { apiClient, ApiClientError } from '../services/apiClient';
import type {
  LanguageItem,
  SampleTravelInquiry,
  ServicePresetKey,
  TravelInquiryReplyResponse,
  TravelInquiryResponse,
} from '../types/translate';
import { LanguageCombobox } from './LanguageCombobox';

interface InquiryDeskPanelProps {
  sampleInquiries: SampleTravelInquiry[];
  travelLanguages: LanguageItem[];
  allLanguages: LanguageItem[];
  servicePreset: ServicePresetKey;
  onError: (msg: string | null) => void;
  onOperationComplete: () => void;
}

interface GuestQuestionItem {
  msgId: string;
  text: string;
  source_lang?: string;
  suggested_reply_en?: string;
}

interface SentReplyMessage extends TravelInquiryReplyResponse {
  replyId: string;
  replyToMsgId: string;
  replyToSnippet: string;
  sentAt: string;
}

interface PersistedConciergeState {
  customThreads: SampleTravelInquiry[];
  extraGuestMessages: Record<string, GuestQuestionItem[]>;
  selectedId: string;
  staffLang: string;
  processedCache: Record<string, TravelInquiryResponse>;
  sentRepliesMap: Record<string, SentReplyMessage[]>;
}

const CONCIERGE_STORAGE_KEY = 'wanderlingo_concierge_session_v2';

function loadPersistedConciergeState(): Partial<PersistedConciergeState> {
  try {
    const raw = sessionStorage.getItem(CONCIERGE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Partial<PersistedConciergeState>) : {};
  } catch {
    return {};
  }
}

export const InquiryDeskPanel: React.FC<InquiryDeskPanelProps> = ({
  sampleInquiries,
  travelLanguages,
  allLanguages,
  servicePreset,
  onError,
  onOperationComplete,
}) => {
  const { t } = useI18n();
  const initialSaved = useRef<Partial<PersistedConciergeState>>(loadPersistedConciergeState());

  const [customThreads, setCustomThreads] = useState<SampleTravelInquiry[]>(
    () => initialSaved.current.customThreads ?? [],
  );
  const [extraGuestMessages, setExtraGuestMessages] = useState<Record<string, GuestQuestionItem[]>>(
    () => initialSaved.current.extraGuestMessages ?? {},
  );
  const [editedTextMap, setEditedTextMap] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string>(
    () => initialSaved.current.selectedId || sampleInquiries[0]?.id || '',
  );
  const [staffLang, setStaffLang] = useState<string>(() => initialSaved.current.staffLang || 'en');
  const [processedCache, setProcessedCache] = useState<Record<string, TravelInquiryResponse>>(
    () => initialSaved.current.processedCache ?? {},
  );
  const [sentRepliesMap, setSentRepliesMap] = useState<Record<string, SentReplyMessage[]>>(
    () => initialSaved.current.sentRepliesMap ?? {},
  );

  // V5 Feedback: Replies must target 1 exact guest message; reply language comes strictly from THAT message
  const [replyTargetMsgId, setReplyTargetMsgId] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState('');
  const [isLoadingActive, setIsLoadingActive] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [newGuestName, setNewGuestName] = useState('');
  const [newInquiryText, setNewInquiryText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const replyInputRef = useRef<HTMLInputElement>(null);
  const onErrorRef = useRef(onError);
  const onCompleteRef = useRef(onOperationComplete);
  onErrorRef.current = onError;
  onCompleteRef.current = onOperationComplete;

  const threads: SampleTravelInquiry[] = [...customThreads, ...sampleInquiries];

  useEffect(() => {
    if (!selectedId && threads.length > 0) {
      setSelectedId(threads[0].id);
    }
  }, [selectedId, threads.length]);

  // Clear targeted message when switching threads so replies never go to a different guest
  useEffect(() => {
    setReplyTargetMsgId(null);
    setReplyInput('');
  }, [selectedId]);

  // Persist Concierge Desk state across tab switches
  useEffect(() => {
    try {
      const payload: PersistedConciergeState = {
        customThreads,
        extraGuestMessages,
        selectedId,
        staffLang,
        processedCache,
        sentRepliesMap,
      };
      sessionStorage.setItem(CONCIERGE_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage quota issues
    }
  }, [
    customThreads,
    extraGuestMessages,
    selectedId,
    staffLang,
    processedCache,
    sentRepliesMap,
  ]);

  const activeThread = threads.find((th) => th.id === selectedId) ?? threads[0] ?? null;

  const getThreadMessages = (thread: SampleTravelInquiry): GuestQuestionItem[] => {
    const initialMsgId = `${thread.id}::msg-0`;
    const first: GuestQuestionItem = {
      msgId: initialMsgId,
      text: editedTextMap[initialMsgId] ?? thread.inquiry_text,
      source_lang: thread.source_lang,
      suggested_reply_en: thread.suggested_reply_en,
    };
    const extras = (extraGuestMessages[thread.id] ?? []).map((m) =>
      editedTextMap[m.msgId] ? { ...m, text: editedTextMap[m.msgId] } : m,
    );
    return [first, ...extras];
  };

  const activeMessages = activeThread ? getThreadMessages(activeThread) : [];
  const activeSentReplies = activeThread ? (sentRepliesMap[activeThread.id] ?? []) : [];

  const makeCacheKey = (msgId: string, lang: string, text: string) =>
    `${servicePreset}:${lang}:${msgId}:${text}`;

  const getLangName = (code: string) => {
    const found =
      travelLanguages.find((l) => l.code === code) ??
      allLanguages.find((l) => l.code === code);
    return found ? found.name : code.toUpperCase();
  };

  // Lazy processing for uncached guest messages in the currently active thread only
  useEffect(() => {
    if (!activeThread) return;
    const msgs = getThreadMessages(activeThread);
    const localSameUpdates: Record<string, TravelInquiryResponse> = {};
    const pendingRemote: Array<{ msg: GuestQuestionItem; cacheKey: string }> = [];

    for (const msg of msgs) {
      const ck = makeCacheKey(msg.msgId, staffLang, msg.text);
      if (processedCache[ck]) continue;

      if (msg.source_lang && msg.source_lang === staffLang) {
        localSameUpdates[ck] = {
          original_text: msg.text,
          detected_lang: msg.source_lang,
          detected_language: getLangName(msg.source_lang),
          confidence: 1.0,
          target_lang: staffLang,
          target_language: getLangName(staffLang),
          translated_text: msg.text,
          pronunciation: null,
          did_you_mean: null,
          needs_translation: false,
          cached: true,
          service_preset: servicePreset,
          latency_ms: 0,
        };
      } else {
        pendingRemote.push({ msg, cacheKey: ck });
      }
    }

    if (Object.keys(localSameUpdates).length > 0) {
      setProcessedCache((prev) => ({ ...prev, ...localSameUpdates }));
    }
    if (pendingRemote.length === 0) return;

    const controller = new AbortController();
    setIsLoadingActive(true);
    onErrorRef.current(null);

    const runSequentially = async () => {
      try {
        for (const item of pendingRemote) {
          if (controller.signal.aborted) return;
          const res = await apiClient.processTravelInquiry(
            {
              inquiryText: item.msg.text,
              targetLanguage: staffLang,
              servicePreset,
            },
            controller.signal,
          );
          if (!controller.signal.aborted) {
            setProcessedCache((prev) => ({ ...prev, [item.cacheKey]: res }));
          }
        }
        if (!controller.signal.aborted) {
          onCompleteRef.current();
        }
      } catch (err: unknown) {
        if ((err as Error).name === 'AbortError' || controller.signal.aborted) return;
        const msg =
          err instanceof ApiClientError
            ? `${err.message} (${err.code})`
            : 'Failed to translate selected message.';
        onErrorRef.current(msg);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingActive(false);
        }
      }
    };

    void runSequentially();
    return () => controller.abort();
  }, [activeThread?.id, activeMessages.length, staffLang, servicePreset, editedTextMap]);

  const handleAddCustomInquiry = () => {
    const cleaned = newInquiryText.trim();
    if (!cleaned) return;
    const cleanName = newGuestName.trim();

    // If sender name matches an existing guest thread, append as a new question in that thread
    const existingMatch = cleanName
      ? threads.find((th) => th.guest_name.toLowerCase() === cleanName.toLowerCase())
      : undefined;

    if (existingMatch) {
      const nextMsg: GuestQuestionItem = {
        msgId: `${existingMatch.id}::msg-${Date.now()}`,
        text: cleaned,
      };
      setExtraGuestMessages((prev) => ({
        ...prev,
        [existingMatch.id]: [...(prev[existingMatch.id] ?? []), nextMsg],
      }));
      setSelectedId(existingMatch.id);
    } else {
      const newId = `inq-custom-${Date.now()}`;
      const newItem: SampleTravelInquiry = {
        id: newId,
        guest_name: cleanName || 'International Guest',
        channel: 'Live Chat',
        badge: 'New Message',
        inquiry_text: cleaned,
        suggested_reply_en:
          'Thank you for reaching out! We have checked this and arranged everything for your visit.',
      };
      setCustomThreads((prev) => [newItem, ...prev]);
      setSelectedId(newId);
    }

    setNewGuestName('');
    setNewInquiryText('');
    setComposerOpen(false);
  };

  const handleApplyTypoFix = (msgId: string, corrected: string) => {
    setEditedTextMap((prev) => ({ ...prev, [msgId]: corrected }));
  };

  const replyTargetMsg = replyTargetMsgId
    ? activeMessages.find((m) => m.msgId === replyTargetMsgId) ?? null
    : null;
  const replyTargetProcessed = replyTargetMsg
    ? processedCache[makeCacheKey(replyTargetMsg.msgId, staffLang, replyTargetMsg.text)]
    : undefined;
  const replyTargetLangCode =
    replyTargetProcessed?.detected_lang ?? replyTargetMsg?.source_lang ?? null;
  const replyTargetLangName =
    replyTargetProcessed?.detected_language ??
    (replyTargetLangCode ? getLangName(replyTargetLangCode) : '');

  const handleStartReplyToMessage = (msgId: string) => {
    setReplyTargetMsgId(msgId);
    window.setTimeout(() => {
      replyInputRef.current?.focus();
    }, 20);
  };

  const handleSendTargetedReply = async () => {
    const draft = replyInput.trim();
    if (!draft || !activeThread || !replyTargetMsg || !replyTargetLangCode) return;
    onError(null);
    setIsSendingReply(true);

    try {
      const res = await apiClient.translateInquiryReply({
        replyText: draft,
        staffLanguage: staffLang,
        guestLanguage: replyTargetLangCode,
        servicePreset,
      });
      const message: SentReplyMessage = {
        ...res,
        replyId: `rep-${Date.now()}`,
        replyToMsgId: replyTargetMsg.msgId,
        replyToSnippet:
          replyTargetMsg.text.length > 72
            ? `${replyTargetMsg.text.slice(0, 72)}...`
            : replyTargetMsg.text,
        sentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setSentRepliesMap((prev) => ({
        ...prev,
        [activeThread.id]: [...(prev[activeThread.id] ?? []), message],
      }));
      setReplyInput('');
      setReplyTargetMsgId(null);
      onOperationComplete();
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? `${err.message} (${err.code})`
          : 'Failed to translate concierge reply.';
      onError(msg);
    } finally {
      setIsSendingReply(false);
    }
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

  const getInitials = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');

  return (
    <div className="space-y-5">
      {/* Top Inbox Header & Working Language Bar */}
      <section className="wl-folio overflow-visible p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-primary)]"
            >
              <MessageSquareText className="h-6 w-6" />
            </div>
            <h2 className="font-heading text-2xl font-extrabold text-[var(--text-primary)]">
              {t('inquiryHeaderTitle')}
            </h2>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-72">
              <LanguageCombobox
                label={t('staffLanguageLabel')}
                value={staffLang}
                onChange={setStaffLang}
                travelLanguages={travelLanguages}
                allLanguages={allLanguages}
              />
            </div>

            <button
              type="button"
              onClick={() => setComposerOpen((prev) => !prev)}
              className="flex min-h-[46px] items-center gap-2 rounded-xl border border-[var(--accent-warm)]/45 bg-[var(--accent-warm-soft)] px-4 py-2.5 text-sm font-bold text-[var(--accent-warm)] transition hover:bg-[var(--accent-warm)] hover:text-white"
            >
              {composerOpen ? (
                <X className="h-4 w-4" aria-hidden="true" />
              ) : (
                <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{t('newInquiryBtn')}</span>
            </button>
          </div>
        </div>

        {/* Collapsible Add Test Inquiry Drawer */}
        {composerOpen && (
          <div className="mt-4 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface-muted)] p-4">
            <div className="mb-2.5 text-xs font-bold uppercase tracking-wider text-[var(--accent-warm)]">
              {t('newInquiryTitle')}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[220px_1fr_auto]">
              <input
                type="text"
                value={newGuestName}
                onChange={(e) => setNewGuestName(e.target.value)}
                placeholder={t('newInquiryNamePlaceholder')}
                className="min-h-[44px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-solid)] px-3.5 py-2 text-sm text-[var(--text-primary)]"
              />
              <input
                type="text"
                value={newInquiryText}
                onChange={(e) => setNewInquiryText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomInquiry();
                  }
                }}
                placeholder={t('newInquiryTextPlaceholder')}
                className="min-h-[44px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-solid)] px-3.5 py-2 text-sm text-[var(--text-primary)]"
              />
              <button
                type="button"
                disabled={!newInquiryText.trim()}
                onClick={handleAddCustomInquiry}
                className="wl-btn-primary flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-5 py-2 text-sm font-bold disabled:opacity-45"
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span>{t('addAndProcessInquiryBtn')}</span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Split-Pane Master-Detail Hospitality Inbox */}
      <section className="wl-folio overflow-hidden">
        <div className="grid min-h-[540px] grid-cols-1 lg:grid-cols-[340px_1.5px_1fr]">
          {/* LEFT PANE: Guest Conversation List */}
          <div className="flex flex-col bg-[var(--bg-surface-muted)]/55">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {t('inboxListTitle')} ({threads.length})
              </span>
              {isLoadingActive && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--accent-primary)]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  {t('translatingBtn')}
                </span>
              )}
            </div>

            <div className="max-h-[300px] divide-y divide-[var(--border-subtle)] overflow-y-auto lg:max-h-[560px]">
              {threads.map((th) => {
                const isSelected = activeThread?.id === th.id;
                const thMsgs = getThreadMessages(th);
                const latestMsg = thMsgs[thMsgs.length - 1];
                const cachedLatest =
                  processedCache[makeCacheKey(latestMsg.msgId, staffLang, latestMsg.text)];
                const langBadge = cachedLatest?.detected_lang ?? latestMsg.source_lang;
                const replyCount = (sentRepliesMap[th.id] ?? []).length;

                return (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => setSelectedId(th.id)}
                    className={`flex w-full items-start gap-3 p-4 text-left transition ${
                      isSelected
                        ? 'border-l-4 border-l-[var(--btn-primary-bg)] bg-[var(--bg-surface-solid)]'
                        : 'hover:bg-[var(--bg-surface-hover)]/65'
                    }`}
                  >
                    <div
                      aria-hidden="true"
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold ${
                        isSelected
                          ? 'wl-btn-primary'
                          : 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                      }`}
                    >
                      {getInitials(th.guest_name)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-heading text-sm font-bold text-[var(--text-primary)]">
                          {th.guest_name}
                        </span>
                        {langBadge && (
                          <span className="shrink-0 rounded-md bg-[var(--accent-cyan-soft)] px-2 py-0.5 font-mono text-[11px] font-bold uppercase text-[var(--accent-cyan)]">
                            {langBadge}
                          </span>
                        )}
                      </div>

                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                        <span className="truncate">{th.channel}</span>
                        {replyCount > 0 && (
                          <span className="rounded-full bg-[var(--accent-warm-soft)] px-2 py-0.2 text-[11px] font-bold text-[var(--accent-warm)]">
                            {replyCount}
                          </span>
                        )}
                      </div>

                      <p className="mt-1 line-clamp-2 text-xs font-medium text-[var(--text-secondary)]">
                        {cachedLatest ? cachedLatest.translated_text : latestMsg.text}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CENTER SPINE */}
          <div className="h-[1.5px] w-full bg-[var(--border-subtle)] lg:h-auto lg:w-[1.5px]" />

          {/* RIGHT PANE: Active Thread with By-Question Reply Targeting */}
          {activeThread && (
            <div className="flex flex-col justify-between bg-[var(--bg-surface-solid)]">
              {/* Thread Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-heading text-xl font-extrabold text-[var(--text-primary)]">
                    {activeThread.guest_name}
                  </h3>
                  <span className="rounded-md bg-[var(--bg-surface-muted)] px-2.5 py-0.5 text-xs font-semibold text-[var(--text-secondary)]">
                    {activeThread.channel}
                  </span>
                  <span className="rounded-md bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-bold text-[var(--accent-primary)]">
                    {activeThread.badge}
                  </span>
                </div>
              </div>

              {/* Messages & Targeted Replies Stream */}
              <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
                {activeMessages.map((msg) => {
                  const proc = processedCache[makeCacheKey(msg.msgId, staffLang, msg.text)];
                  const msgLang = proc?.detected_lang ?? msg.source_lang ?? 'en';
                  const msgLangLabel = proc?.detected_language ?? getLangName(msgLang);
                  const isTargeted = replyTargetMsgId === msg.msgId;
                  const repliesForThisMsg = activeSentReplies.filter(
                    (r) => r.replyToMsgId === msg.msgId,
                  );

                  return (
                    <div key={msg.msgId} className="space-y-3">
                      {/* Guest Question Bubble (Left-Aligned) */}
                      <div className="max-w-2xl">
                        <div
                          className={`rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl border p-4 transition sm:p-5 ${
                            isTargeted
                              ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)]/50 shadow-sm'
                              : 'border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]'
                          }`}
                        >
                          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold uppercase tracking-wider text-[var(--text-muted)]">
                                {activeThread.guest_name}
                              </span>
                              <span className="rounded-md bg-[var(--accent-cyan-soft)] px-2 py-0.5 font-bold text-[var(--accent-cyan)]">
                                {msgLangLabel} ({msgLang})
                                {proc?.confidence !== null && proc?.confidence !== undefined
                                  ? ` · ${Math.round(proc.confidence * 100)}%`
                                  : ''}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleSpeak(msg.text, msgLang)}
                                className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-surface-solid)] px-2.5 py-1 text-xs font-bold text-[var(--text-primary)] transition hover:text-[var(--accent-cyan)]"
                              >
                                <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                                {t('speakBtn')}
                              </button>

                              {/* V5 Feedback: Per-question Reply trigger that locks reply language to THIS exact message */}
                              <button
                                type="button"
                                disabled={!proc && isLoadingActive}
                                onClick={() => handleStartReplyToMessage(msg.msgId)}
                                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold transition disabled:opacity-45 ${
                                  isTargeted
                                    ? 'wl-btn-primary'
                                    : 'bg-[var(--bg-surface-solid)] text-[var(--accent-primary)] hover:bg-[var(--btn-primary-bg)] hover:text-white'
                                }`}
                              >
                                <CornerUpLeft className="h-3.5 w-3.5" aria-hidden="true" />
                                {t('replyToMessageBtn')}
                              </button>
                            </div>
                          </div>

                          <p className="text-base font-medium leading-relaxed text-[var(--text-primary)] sm:text-lg">
                            “{msg.text}”
                          </p>

                          {proc?.did_you_mean && (
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border-l-4 border-[var(--accent-warm)] bg-[var(--accent-warm-soft)] px-3 py-2 text-xs">
                              <span className="flex items-center gap-1.5 text-[var(--text-primary)]">
                                <Wand2
                                  className="h-3.5 w-3.5 text-[var(--accent-warm)]"
                                  aria-hidden="true"
                                />
                                {t('didYouMeanPrefix')} <strong>{proc.did_you_mean}</strong>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleApplyTypoFix(msg.msgId, proc.did_you_mean!)}
                                className="rounded-full bg-[var(--accent-warm)] px-3 py-1 font-bold text-white"
                              >
                                {t('applySuggestionBtn')}
                              </button>
                            </div>
                          )}

                          {isLoadingActive && !proc ? (
                            <div className="mt-3.5 flex items-center gap-2 border-t border-[var(--border-subtle)] pt-3.5 text-sm font-semibold text-[var(--accent-primary)]">
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                              <span>{t('translatingBtn')}</span>
                            </div>
                          ) : (
                            proc?.needs_translation && (
                              <div className="mt-3.5 border-t border-[var(--border-subtle)] pt-3.5">
                                <div className="rounded-xl border-l-4 border-[var(--line-accent-1)] bg-[var(--bg-surface-solid)] p-3.5">
                                  <div className="mb-1 text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)]">
                                    {t('translatedForYouLabel')} ({proc.target_language})
                                  </div>
                                  <p className="text-base font-bold leading-relaxed text-[var(--text-primary)] sm:text-lg">
                                    {proc.translated_text}
                                  </p>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>

                      {/* Targeted Replies Linked to This Exact Guest Question */}
                      {repliesForThisMsg.map((rep) => (
                        <div key={rep.replyId} className="ml-auto max-w-2xl">
                          <div className="rounded-tl-2xl rounded-tr-sm rounded-br-2xl rounded-bl-2xl border border-[var(--accent-primary)]/35 bg-[var(--bg-surface-tint)] p-4 sm:p-5">
                            {/* Quoted Message Context */}
                            <div className="mb-2.5 flex items-center gap-2 rounded-lg border-l-2 border-[var(--accent-cyan)] bg-[var(--bg-surface-solid)]/80 px-3 py-1.5 text-xs text-[var(--text-muted)]">
                              <CornerUpLeft className="h-3.5 w-3.5 shrink-0 text-[var(--accent-cyan)]" aria-hidden="true" />
                              <span className="truncate italic">“{rep.replyToSnippet}”</span>
                            </div>

                            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                              <span className="font-bold text-[var(--accent-primary)]">
                                {t('sentReplyHeader')} {rep.dest_name} ({rep.dest})
                              </span>
                              <span className="font-mono text-[var(--text-muted)]">
                                {rep.sentAt}
                              </span>
                            </div>

                            <p className="font-heading text-lg font-bold leading-relaxed text-[var(--text-primary)] sm:text-xl">
                              {rep.translated_reply}
                            </p>

                            {rep.pronunciation && (
                              <p className="mt-1 font-mono text-xs text-[var(--accent-cyan)]">
                                {rep.pronunciation}
                              </p>
                            )}

                            {rep.translated_reply.trim() !== rep.staff_text.trim() && (
                              <p className="mt-2.5 border-t border-[var(--border-subtle)] pt-2 text-xs text-[var(--text-secondary)]">
                                {rep.staff_text}
                              </p>
                            )}

                            <div className="mt-3 flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleSpeak(rep.translated_reply, rep.dest)}
                                className="flex min-h-[34px] items-center gap-1 rounded-lg bg-[var(--bg-surface-solid)] px-3 py-1 text-xs font-bold text-[var(--text-primary)] transition hover:text-[var(--accent-cyan)]"
                              >
                                <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>{t('speakBtn')}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => void handleCopy(rep.replyId, rep.translated_reply)}
                                className="flex min-h-[34px] items-center gap-1 rounded-lg bg-[var(--bg-surface-solid)] px-3 py-1 text-xs font-bold text-[var(--text-primary)] transition hover:text-[var(--accent-primary)]"
                              >
                                {copiedId === rep.replyId ? (
                                  <>
                                    <Check
                                      className="h-3.5 w-3.5 text-emerald-500"
                                      aria-hidden="true"
                                    />
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
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              {/* Bottom By-Question Reply Bar (Only Active When Replying to 1 Exact Guest Message) */}
              <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]/60 p-4 sm:px-6">
                {!replyTargetMsg ? (
                  <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface-solid)]/70 px-4 py-3 text-sm font-medium text-[var(--text-muted)]">
                    <CornerUpLeft className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" aria-hidden="true" />
                    <span>{t('selectMessageToReplyHint')}</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Active Quoted Target Banner showing the automatic derived language */}
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-l-4 border-[var(--accent-cyan)] bg-[var(--bg-surface-solid)] px-3.5 py-2 text-xs">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="font-bold text-[var(--accent-cyan)]">
                          {t('replyingToBannerPrefix')}:
                        </span>
                        <span className="truncate font-medium text-[var(--text-secondary)]">
                          “{replyTargetMsg.text}”
                        </span>
                        {replyTargetLangCode && (
                          <span className="shrink-0 rounded-md bg-[var(--accent-soft)] px-2 py-0.5 font-bold text-[var(--accent-primary)]">
                            → {replyTargetLangName} ({replyTargetLangCode})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {staffLang === 'en' && replyTargetMsg.suggested_reply_en && (
                          <button
                            type="button"
                            onClick={() => setReplyInput(replyTargetMsg.suggested_reply_en!)}
                            className="shrink-0 rounded-md bg-[var(--accent-soft)] px-2.5 py-1 font-bold text-[var(--accent-primary)] transition hover:bg-[var(--btn-primary-bg)] hover:text-white"
                          >
                            {t('useSuggestedReplyBtn')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setReplyTargetMsgId(null)}
                          aria-label="Cancel reply"
                          className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-surface-muted)] hover:text-[var(--text-primary)]"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2.5 sm:flex-row">
                      <input
                        ref={replyInputRef}
                        type="text"
                        value={replyInput}
                        onChange={(e) => setReplyInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            void handleSendTargetedReply();
                          }
                        }}
                        placeholder={t('conciergeReplyPlaceholder')}
                        className="min-h-[46px] flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-solid)] px-4 py-2.5 text-base text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
                      />
                      <button
                        type="button"
                        disabled={isSendingReply || !replyInput.trim() || !replyTargetLangCode}
                        onClick={() => void handleSendTargetedReply()}
                        className="wl-btn-primary flex min-h-[46px] shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold shadow-xs disabled:opacity-45"
                      >
                        <Send className="h-4 w-4" aria-hidden="true" />
                        <span>
                          {isSendingReply
                            ? t('translatingBtn')
                            : `${t('translateReplyBtn')} (${replyTargetLangName})`}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
