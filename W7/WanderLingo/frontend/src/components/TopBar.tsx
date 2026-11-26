import React, { useState } from 'react';
import {
  Compass,
  Database,
  Languages,
  MessageSquareText,
  Moon,
  Plane,
  SlidersHorizontal,
  Star,
  Sun,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import type {
  HealthResponse,
  ServicePresetKey,
  WorkspaceTab,
} from '../types/translate';
import { ModalDialog } from './ModalDialog';

interface TopBarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  servicePreset: ServicePresetKey;
  onChangePreset: (preset: ServicePresetKey) => void;
  health: HealthResponse | null;
  onClearCache: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  servicePreset,
  onChangePreset,
  health,
  onClearCache,
}) => {
  const { locale, setLocale, t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const tabs: Array<{ id: WorkspaceTab; label: string; icon: React.ReactNode }> = [
    {
      id: 'translator',
      label: t('tabTranslator'),
      icon: <Languages className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: 'destinations',
      label: t('tabDestinations'),
      icon: <Compass className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: 'reviews',
      label: t('tabReviews'),
      icon: <Star className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: 'inquiries',
      label: t('tabInquiries'),
      icon: <MessageSquareText className="h-4 w-4" aria-hidden="true" />,
    },
  ];

  const presetOptions: Array<{ key: ServicePresetKey; label: string; desc: string }> = [
    {
      key: 'default',
      label: t('presetDefault'),
      desc: 'translate.google.com',
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
      <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-3.5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Travel Brand Emblem */}
            <div className="flex items-center gap-3.5">
              <div
                aria-hidden="true"
                className="flex h-12 w-12 items-center justify-center rounded-tl-lg rounded-tr-2xl rounded-br-lg rounded-bl-2xl bg-gradient-to-br from-[#5b3df5] via-[#0891b2] to-[#c8431f] text-white shadow-md"
              >
                <Plane className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="font-heading text-xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-2xl">
                    {t('appName')}
                  </h1>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--status-good-bg)] px-2.5 py-0.5 text-xs font-semibold text-[var(--status-good-text)]">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        health ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                    {health ? t('backendConnected') : t('backendOffline')}
                  </span>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">{t('appSubtitle')}</p>
              </div>
            </div>

            {/* Right Controls: Engine Dialog Trigger, EN/VI Pill, Bright/Dim Theme Pill */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--accent-primary)] hover:bg-[var(--bg-surface-hover)]"
              >
                <SlidersHorizontal className="h-4 w-4 text-[var(--accent-primary)]" aria-hidden="true" />
                <span>{t('engineSettingsBtn')}</span>
                {health && (
                  <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 font-mono text-xs font-bold text-[var(--accent-primary)]">
                    {health.cache_hits}
                  </span>
                )}
              </button>

              {/* EN / VI Segmented Pill */}
              <div
                role="group"
                aria-label="Interface Language"
                className="flex min-h-[44px] items-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] p-1 text-sm font-bold"
              >
                <button
                  type="button"
                  onClick={() => setLocale('en')}
                  aria-pressed={locale === 'en'}
                  className={`rounded-full px-3.5 py-1.5 transition ${
                    locale === 'en'
                      ? 'wl-btn-primary shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLocale('vi')}
                  aria-pressed={locale === 'vi'}
                  className={`rounded-full px-3.5 py-1.5 transition ${
                    locale === 'vi'
                      ? 'wl-btn-primary shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  VI
                </button>
              </div>

              {/* Light Theme / Dark Theme Toggle Pill */}
              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Toggle Light Theme or Dark Theme"
                className="flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--accent-primary)] hover:bg-[var(--bg-surface-hover)]"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="h-4 w-4 text-[var(--accent-warm)]" aria-hidden="true" />
                    <span>{t('themeLight')}</span>
                  </>
                ) : (
                  <>
                    <Moon className="h-4 w-4 text-[var(--accent-primary)]" aria-hidden="true" />
                    <span>{t('themeDark')}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Editorial Tab Switcher */}
          <nav aria-label="Workspaces" className="mt-3.5 flex overflow-x-auto pb-0.5">
            <div className="inline-flex min-w-full gap-1.5 rounded-tl-lg rounded-tr-2xl rounded-br-lg rounded-bl-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] p-1.5 sm:min-w-0">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onSelectTab(tab.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex min-h-[42px] shrink-0 flex-1 items-center justify-center gap-2 rounded-tl-md rounded-tr-xl rounded-br-md rounded-bl-xl px-4 py-2 text-sm font-bold transition sm:flex-initial sm:px-5 ${
                      isActive
                        ? 'wl-btn-primary shadow-sm'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      </header>

      {/* Sculpted Engine & Endpoint Inspector Dialog */}
      <ModalDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title={t('engineDialogTitle')}
        subtitle={t('engineDialogSubtitle')}
        icon={<SlidersHorizontal className="h-5 w-5" />}
        maxWidthClass="max-w-xl"
      >
        <div className="space-y-5">
          {/* Live Stats Row */}
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

          {/* Endpoint Routing Radio Cards */}
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
