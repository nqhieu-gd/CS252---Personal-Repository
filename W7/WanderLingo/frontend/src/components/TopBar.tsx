import React from 'react';
import {
  Compass,
  Database,
  Languages,
  MessageSquareText,
  Moon,
  Server,
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

  const tabs: Array<{ id: WorkspaceTab; label: string; icon: React.ReactNode }> = [
    {
      id: 'translator',
      label: t('tabTranslator'),
      icon: <Languages className="h-4 w-4" />,
    },
    {
      id: 'destinations',
      label: t('tabDestinations'),
      icon: <Compass className="h-4 w-4" />,
    },
    {
      id: 'reviews',
      label: t('tabReviews'),
      icon: <Star className="h-4 w-4" />,
    },
    {
      id: 'inquiries',
      label: t('tabInquiries'),
      icon: <MessageSquareText className="h-4 w-4" />,
    },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-primary)] text-white shadow-sm">
              <Languages className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
                  {t('appName')}
                </h1>
                <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 font-mono text-xs font-semibold text-[var(--accent-primary)]">
                  googletrans {health?.googletrans_version ?? '4.0.2'}
                </span>
              </div>
              <p className="text-sm text-[var(--text-secondary)]">{t('appSubtitle')}</p>
            </div>
          </div>

          {/* Right Controls: Endpoint Preset, Health/Cache, EN/VI, Theme */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Tutorial Sec 5: Custom Service URLs Selector */}
            <div className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-3 py-2 text-sm">
              <Server className="h-4 w-4 text-[var(--accent-primary)]" />
              <span className="hidden font-medium text-[var(--text-secondary)] md:inline">
                {t('servicePresetLabel')}:
              </span>
              <select
                aria-label={t('servicePresetLabel')}
                value={servicePreset}
                onChange={(e) => onChangePreset(e.target.value as ServicePresetKey)}
                className="bg-transparent font-semibold text-[var(--text-primary)] outline-none"
              >
                <option value="default">{t('presetDefault')}</option>
                <option value="direct">{t('presetDirect')}</option>
                <option value="redundant">{t('presetRedundant')}</option>
              </select>
            </div>

            {/* Health & Cache Pill */}
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-3 py-2 text-sm">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  health ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              <span className="font-medium">
                {health ? t('backendConnected') : t('backendOffline')}
              </span>
              {health && (
                <>
                  <span className="text-[var(--text-muted)]">·</span>
                  <span className="flex items-center gap-1 text-[var(--text-secondary)]">
                    <Database className="h-3.5 w-3.5" />
                    {t('cacheHitsLabel')}: <strong>{health.cache_hits}</strong>
                  </span>
                  {health.cache_size > 0 && (
                    <button
                      type="button"
                      onClick={onClearCache}
                      className="ml-1 rounded bg-[var(--bg-surface)] px-2 py-0.5 text-xs font-medium text-[var(--accent-primary)] hover:underline"
                    >
                      {t('clearCacheBtn')}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* EN / VI Toggle */}
            <div
              role="group"
              aria-label="Interface Language"
              className="flex rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] p-0.5 text-sm font-semibold"
            >
              <button
                type="button"
                onClick={() => setLocale('en')}
                className={`rounded-lg px-3 py-1.5 transition ${
                  locale === 'en'
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLocale('vi')}
                className={`rounded-lg px-3 py-1.5 transition ${
                  locale === 'vi'
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                VI
              </button>
            </div>

            {/* Light / Dark Mode Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle Light/Dark Theme"
              className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent-primary)]"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="h-4 w-4 text-amber-400" />
                  <span className="hidden sm:inline">{t('themeLight')}</span>
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 text-sky-600" />
                  <span className="hidden sm:inline">{t('themeDark')}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 4 Workspace Navigation Tabs */}
        <nav
          aria-label="Workspaces"
          className="mt-3 flex gap-2 overflow-x-auto pb-1"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition sm:text-base ${
                  isActive
                    ? 'bg-[var(--accent-primary)] text-white shadow-xs'
                    : 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
