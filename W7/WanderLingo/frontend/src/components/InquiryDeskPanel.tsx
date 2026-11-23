import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  MessageSquareText,
  Plus,
  Send,
  Sparkles,
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

export const InquiryDeskPanel: React.FC<InquiryDeskPanelProps> = ({
  sampleInquiries,
  travelLanguages,
  allLanguages,
  servicePreset,
  onError,
  onOperationComplete,
}) => {
  const { t } = useI18n();
  const [inquiries, setInquiries] = useState<SampleTravelInquiry[]>(sampleInquiries);
  const [staffLang, setStaffLang] = useState('en');
  const [processedMap, setProcessedMap] = useState<Record<string, TravelInquiryResponse>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyResults, setReplyResults] = useState<Record<string, TravelInquiryReplyResponse>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [newGuestName, setNewGuestName] = useState('');
  const [newInquiryText, setNewInquiryText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (sampleInquiries.length > 0 && inquiries.length === 0) {
      setInquiries(sampleInquiries);
      const initialDrafts: Record<string, string> = {};
      for (const item of sampleInquiries) {
        initialDrafts[item.id] = item.suggested_reply_en;
      }
      setReplyDrafts(initialDrafts);
    } else if (Object.keys(replyDrafts).length === 0 && sampleInquiries.length > 0) {
      const initialDrafts: Record<string, string> = {};
      for (const item of sampleInquiries) {
        initialDrafts[item.id] = item.suggested_reply_en;
      }
      setReplyDrafts(initialDrafts);
    }
  }, [sampleInquiries, inquiries.length, replyDrafts]);

  const processOneInquiry = async (inq: SampleTravelInquiry) => {
    onError(null);
    setProcessingId(inq.id);
    try {
      const res = await apiClient.processTravelInquiry({
        inquiryText: inq.inquiry_text,
        targetLanguage: staffLang,
        servicePreset,
      });
      setProcessedMap((prev) => ({ ...prev, [inq.id]: res }));
      onOperationComplete();
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? `${err.message} (${err.code})`
          : 'Failed to process travel inquiry.';
      onError(msg);
    } finally {
      setProcessingId(null);
    }
  };

  const processAllInquiries = async () => {
    onError(null);
    setIsProcessingAll(true);
    try {
      for (const inq of inquiries) {
        const res = await apiClient.processTravelInquiry({
          inquiryText: inq.inquiry_text,
          targetLanguage: staffLang,
          servicePreset,
        });
        setProcessedMap((prev) => ({ ...prev, [inq.id]: res }));
      }
      onOperationComplete();
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? `${err.message} (${err.code})`
          : 'Failed to process inquiries.';
      onError(msg);
    } finally {
      setIsProcessingAll(false);
    }
  };

  const handleAddAndProcessCustomInquiry = async () => {
    const cleaned = newInquiryText.trim();
    if (!cleaned) return;
    const newId = `inq-custom-${Date.now()}`;
    const newItem: SampleTravelInquiry = {
      id: newId,
      guest_name: newGuestName.trim() || 'International Guest',
      channel: 'Live Concierge Desk',
      badge: 'Custom Inquiry',
      inquiry_text: cleaned,
      suggested_reply_en:
        'Thank you for contacting our concierge desk! We have arranged this request for your stay.',
    };
    setInquiries((prev) => [newItem, ...prev]);
    setReplyDrafts((prev) => ({ ...prev, [newId]: newItem.suggested_reply_en }));
    setNewGuestName('');
    setNewInquiryText('');
    await processOneInquiry(newItem);
  };

  const handleTranslateReply = async (inqId: string, guestLang: string) => {
    const draft = (replyDrafts[inqId] ?? '').trim();
    if (!draft) return;
    onError(null);
    setReplyingId(inqId);
    try {
      const res = await apiClient.translateInquiryReply({
        replyText: draft,
        staffLanguage: staffLang,
        guestLanguage: guestLang,
        servicePreset,
      });
      setReplyResults((prev) => ({ ...prev, [inqId]: res }));
      onOperationComplete();
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? `${err.message} (${err.code})`
          : 'Failed to translate concierge reply.';
      onError(msg);
    } finally {
      setReplyingId(null);
    }
  };

  const handleCopyReply = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Staff Working Language Bar */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--text-primary)] sm:text-xl">
            <MessageSquareText className="h-5 w-5 text-[var(--accent-primary)]" />
            <span>{t('inquiryHeaderTitle')}</span>
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-[var(--text-secondary)] sm:text-base">
            {t('inquiryHeaderSubtitle')}
          </p>
        </div>

        {/* Submit Custom Inquiry Box */}
        <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] p-4">
          <div className="mb-2 text-sm font-semibold text-[var(--text-primary)]">
            {t('newInquiryTitle')}
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[220px_1fr_auto]">
            <input
              type="text"
              value={newGuestName}
              onChange={(e) => setNewGuestName(e.target.value)}
              placeholder={t('newInquiryNamePlaceholder')}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] sm:text-base"
            />
            <input
              type="text"
              value={newInquiryText}
              onChange={(e) => setNewInquiryText(e.target.value)}
              placeholder={t('newInquiryTextPlaceholder')}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] sm:text-base"
            />
            <button
              type="button"
              disabled={!newInquiryText.trim() || processingId !== null}
              onClick={() => void handleAddAndProcessCustomInquiry()}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)] disabled:opacity-50"
            >
              <Plus className="h-4 w-4 text-[var(--accent-primary)]" />
              <span>{t('addAndProcessInquiryBtn')}</span>
            </button>
          </div>
        </div>

        {/* Staff Language & Process All Button */}
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
          <div className="w-full sm:w-80">
            <LanguageCombobox
              label={t('staffLanguageLabel')}
              value={staffLang}
              onChange={(code) => {
                setStaffLang(code);
                setProcessedMap({});
                setReplyResults({});
              }}
              travelLanguages={travelLanguages}
              allLanguages={allLanguages}
            />
          </div>

          <button
            type="button"
            disabled={isProcessingAll}
            onClick={() => void processAllInquiries()}
            className="flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-5 py-3 text-sm font-semibold text-white shadow-xs transition hover:bg-[var(--accent-primary-hover)] disabled:opacity-50 sm:text-base"
          >
            <Sparkles className="h-4 w-4" />
            <span>
              {isProcessingAll
                ? t('translatingBtn')
                : `${t('processAllInquiriesBtn')} (${inquiries.length})`}
            </span>
          </button>
        </div>
      </div>

      {/* Inquiries List */}
      <div className="space-y-4">
        {inquiries.map((inq) => {
          const processed = processedMap[inq.id];
          const replyRes = replyResults[inq.id];

          return (
            <div
              key={inq.id}
              className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-bold text-[var(--text-primary)]">
                    {inq.guest_name}
                  </span>
                  <span className="rounded-md bg-[var(--bg-surface-muted)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                    {inq.channel}
                  </span>
                  <span className="rounded-full bg-[var(--accent-soft)] px-3 py-0.5 text-xs font-semibold text-[var(--accent-primary)]">
                    {inq.badge}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={processingId === inq.id || isProcessingAll}
                  onClick={() => void processOneInquiry(inq)}
                  className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-3.5 py-2 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)] disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4 text-[var(--accent-primary)]" />
                  <span>
                    {processingId === inq.id
                      ? t('translatingBtn')
                      : t('processSingleInquiryBtn')}
                  </span>
                </button>
              </div>

              {/* Original & Processed Inquiry */}
              <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] p-4">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    {t('originalInquiryLabel')}
                  </div>
                  <p className="text-base font-medium leading-relaxed text-[var(--text-primary)]">
                    “{inq.inquiry_text}”
                  </p>
                </div>

                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] p-4">
                  {!processed ? (
                    <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)] italic">
                      {t('unprocessedInquiryHint')}
                    </div>
                  ) : (
                    <div>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5 text-xs">
                        <span className="font-bold text-[var(--accent-primary)]">
                          {t('detectedSourceBadge')}: {processed.detected_language} (
                          {processed.detected_lang})
                          {processed.confidence !== null
                            ? ` · ${Math.round(processed.confidence * 100)}%`
                            : ''}
                        </span>
                        <span
                          className={`flex items-center gap-1 rounded-full px-3 py-0.5 font-semibold ${
                            processed.needs_translation
                              ? 'bg-[var(--status-good-bg)] text-[var(--status-good-text)]'
                              : 'bg-[var(--status-caution-bg)] text-[var(--status-caution-text)]'
                          }`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {processed.needs_translation
                            ? t('needsTranslationYes')
                            : t('needsTranslationNo')}
                        </span>
                      </div>
                      <p className="text-base font-bold leading-relaxed text-[var(--text-primary)]">
                        {processed.translated_text}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Two-Way Concierge Reply Composer */}
              {processed && (
                <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]/60 p-4">
                  <div className="mb-2 text-sm font-semibold text-[var(--text-primary)]">
                    {t('conciergeReplyLabel')} ({processed.target_language} →{' '}
                    {processed.detected_language})
                  </div>
                  <div className="flex flex-col gap-2.5 sm:flex-row">
                    <input
                      type="text"
                      value={replyDrafts[inq.id] ?? ''}
                      onChange={(e) =>
                        setReplyDrafts((prev) => ({ ...prev, [inq.id]: e.target.value }))
                      }
                      placeholder={t('conciergeReplyPlaceholder')}
                      className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] sm:text-base"
                    />
                    <button
                      type="button"
                      disabled={replyingId === inq.id || !(replyDrafts[inq.id] ?? '').trim()}
                      onClick={() => void handleTranslateReply(inq.id, processed.detected_lang)}
                      className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-primary-hover)] disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                      <span>
                        {replyingId === inq.id ? t('translatingBtn') : t('translateReplyBtn')}
                      </span>
                    </button>
                  </div>

                  {replyRes && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--accent-primary)]/30 bg-[var(--accent-soft)]/50 px-3.5 py-2.5 text-sm">
                      <div>
                        <span className="font-semibold text-[var(--accent-primary)]">
                          {t('translatedReplyOutputLabel')} ({replyRes.dest_name}):{' '}
                        </span>
                        <span className="text-base font-bold text-[var(--text-primary)]">
                          {replyRes.translated_reply}
                        </span>
                        {replyRes.pronunciation && (
                          <div className="mt-1 font-mono text-xs text-[var(--text-secondary)]">
                            {replyRes.pronunciation}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleCopyReply(inq.id, replyRes.translated_reply)}
                        className="flex items-center gap-1 rounded-md bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)]"
                      >
                        {copiedId === inq.id ? (
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
