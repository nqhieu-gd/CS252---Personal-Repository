import React, { useState } from 'react';
import { Database, SlidersHorizontal } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import type { HealthResponse, ServicePresetKey } from '../types/translate';
import { ModalDialog } from './ModalDialog';

interface FooterProps {
  servicePreset: ServicePresetKey;
  onChangePreset: (preset: ServicePresetKey) => void;
  health: HealthResponse | null;
  onClearCache: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  servicePreset,
  onChangePreset,
  health,
  onClearCache,
}) => {
  const { t } = useI18n();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const presetOptions: Array<{ key: ServicePresetKey; label: string; desc: string }> = [
    {
      key: 'default',
      label: t('presetDefault'),
      desc: 'translate.google.com (auto-failover enabled)',
    },
    {
      key: 'direct',
      label: t('presetDirect'),
      desc: 'translate.googleapis.com',
    },
    {
      key: 'redundant',
      label: t('presetRedundant'),
      desc: 'translate.google.com · .co.kr · .co.jp',
    },
  ];

  return (
    <>
      <footer className="mt-14 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] py-5 text-sm font-medium text-[var(--text-muted)] backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 sm:px-6">
          <span>{t('footerText')}</span>

          {/* Subtle Advanced Routing & Cache Inspector tucked in Footer instead of Header */}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-[var(--text-muted)] transition hover:bg-[var(--bg-surface-muted)] hover:text-[var(--text-primary)]"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('footerRoutingLink')}</span>
          </button>
        </div>
      </footer>

      <ModalDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title={t('engineDialogTitle')}
        subtitle={t('engineDialogSubtitle')}
        icon={<SlidersHorizontal className="h-5 w-5" />}
        maxWidthClass="max-w-xl"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="wl-well p-3.5 text-center">
              <div className="text-xs font-semibold text-[var(--text-muted)]">py-googletrans</div>
              <div className="mt-1 font-mono text-lg font-bold text-[var(--accent-primary)]">
                v{health?.googletrans_version ?? '4.0.2'}
              </div>
            </div>
            <div className="wl-well p-3.5 text-center">
              <div className="text-xs font-semibold text-[var(--text-muted)]">
                {t('cacheHitsLabel')}
              </div>
              <div className="mt-1 font-mono text-lg font-bold text-[var(--text-primary)]">
                {health?.cache_hits ?? 0}
              </div>
            </div>
            <div className="wl-well p-3.5 text-center">
              <div className="text-xs font-semibold text-[var(--text-muted)]">
                {t('cacheEntriesLabel')}
              </div>
              <div className="mt-1 font-mono text-lg font-bold text-[var(--text-primary)]">
                {health?.cache_size ?? 0} / {health?.cache_max_entries ?? 500}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2.5 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t('servicePresetLabel')}
            </div>
            <div className="space-y-2.5">
              {presetOptions.map((opt) => {
                const selected = servicePreset === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => onChangePreset(opt.key)}
                    aria-pressed={selected}
                    className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${
                      selected
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] hover:border-[var(--accent-primary)]'
                    }`}
                  >
                    <div>
                      <div className="text-base font-bold text-[var(--text-primary)]">
                        {opt.label}
                      </div>
                      <div className="font-mono text-xs text-[var(--text-secondary)]">
                        {opt.desc}
                      </div>
                    </div>
                    <span
                      className={`h-4 w-4 rounded-full border-2 ${
                        selected
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]'
                          : 'border-[var(--text-muted)]'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
            <button
              type="button"
              disabled={!health || health.cache_size === 0}
              onClick={onClearCache}
              className="flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--accent-primary)] disabled:opacity-45"
            >
              <Database className="h-4 w-4 text-[var(--accent-primary)]" aria-hidden="true" />
              <span>{t('clearCacheBtn')}</span>
            </button>

            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className="wl-btn-primary min-h-[44px] rounded-full px-6 py-2 text-sm font-bold"
            >
              {t('closeDialogBtn')}
            </button>
          </div>
        </div>
      </ModalDialog>
    </>
  );
};
