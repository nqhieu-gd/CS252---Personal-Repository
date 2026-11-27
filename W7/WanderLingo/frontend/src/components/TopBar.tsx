import React from 'react';
import {
  Compass,
  Languages,
  MessageSquareText,
  Moon,
  Plane,
  Star,
  Sun,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import type { WorkspaceTab } from '../types/translate';

interface TopBarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ activeTab, onSelectTab }) => {
  const { locale, setLocale, t } = useI18n();
  const { theme, toggleTheme } = useTheme();

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

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 py-3.5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Travel Brand Emblem (V3 Feedback #1: clean header without "Engine Ready" status tag) */}
          <div className="flex items-center gap-3.5">
            <div
              aria-hidden="true"
              className="flex h-12 w-12 items-center justify-center rounded-tl-lg rounded-tr-2xl rounded-br-lg rounded-bl-2xl bg-gradient-to-br from-[#5b3df5] via-[#0891b2] to-[#c8431f] text-white shadow-md"
            >
              <Plane className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-heading text-xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-2xl">
                {t('appName')}
              </h1>
              <p className="text-sm text-[var(--text-secondary)]">{t('appSubtitle')}</p>
            </div>
          </div>

          {/* Right Controls: EN/VI Pill & Light/Dark Theme Toggle (V3 Feedback #2: Engine moved out of header) */}
          <div className="flex flex-wrap items-center gap-2.5">
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

        {/* Workspace Navigation Tabs */}
        <nav aria-label="Workspaces" className="mt-3.5 flex overflow-x-auto pb-0.5">
          <div className="inline-flex min-w-full gap-1.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] p-1.5 sm:min-w-0">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSelectTab(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex min-h-[42px] shrink-0 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition sm:flex-initial sm:px-5 ${
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
  );
};
