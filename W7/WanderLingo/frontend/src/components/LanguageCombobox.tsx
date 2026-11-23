import React, { useMemo, useRef, useState, useEffect } from 'react';
import { ChevronDown, Globe, Search } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import type { LanguageItem } from '../types/translate';

interface LanguageComboboxProps {
  label: string;
  value: string;
  onChange: (code: string) => void;
  travelLanguages: LanguageItem[];
  allLanguages: LanguageItem[];
  includeAuto?: boolean;
}

export const LanguageCombobox: React.FC<LanguageComboboxProps> = ({
  label,
  value,
  onChange,
  travelLanguages,
  allLanguages,
  includeAuto = false,
}) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const currentName = useMemo(() => {
    if (value === 'auto') return t('autoDetect');
    const found =
      travelLanguages.find((l) => l.code === value) ??
      allLanguages.find((l) => l.code === value);
    return found ? `${found.name} (${found.code})` : value;
  }, [value, travelLanguages, allLanguages, t]);

  const filteredTravel = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return travelLanguages;
    return travelLanguages.filter(
      (l) => l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q),
    );
  }, [query, travelLanguages]);

  const filteredAll = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allLanguages;
    return allLanguages.filter(
      (l) => l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q),
    );
  }, [query, allLanguages]);

  const selectCode = (code: string) => {
    onChange(code);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1.5">
      <span className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-base font-medium text-[var(--text-primary)] shadow-xs transition hover:border-[var(--accent-primary)]"
      >
        <span className="flex items-center gap-2 truncate">
          <Globe className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
          <span className="truncate">{currentName}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-40 mt-1.5 w-80 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-2.5 shadow-xl sm:w-96">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-[var(--text-muted)]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('searchLanguagePlaceholder')}
              autoFocus
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] py-2 pr-3 pl-9 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
            />
          </div>

          <div className="max-h-72 overflow-y-auto pr-1 text-sm">
            {includeAuto && (
              <button
                type="button"
                onClick={() => selectCode('auto')}
                className={`mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left font-medium transition ${
                  value === 'auto'
                    ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                    : 'hover:bg-[var(--bg-surface-muted)]'
                }`}
              >
                <span>{t('autoDetect')}</span>
                <span className="rounded bg-[var(--bg-surface-muted)] px-1.5 py-0.5 font-mono text-xs">
                  auto
                </span>
              </button>
            )}

            {filteredTravel.length > 0 && (
              <div className="mb-2">
                <div className="px-2 py-1 text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)]">
                  {t('pinnedTravelLanguages')}
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {filteredTravel.map((lang) => (
                    <button
                      key={`travel-${lang.code}`}
                      type="button"
                      onClick={() => selectCode(lang.code)}
                      className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-left transition ${
                        value === lang.code
                          ? 'bg-[var(--accent-soft)] font-semibold text-[var(--accent-primary)]'
                          : 'hover:bg-[var(--bg-surface-muted)]'
                      }`}
                    >
                      <span className="truncate">{lang.name}</span>
                      <span className="ml-1 font-mono text-xs opacity-75">{lang.code}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="px-2 py-1 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {t('allSupportedLanguages')} ({filteredAll.length})
              </div>
              {filteredAll.map((lang) => (
                <button
                  key={`all-${lang.code}`}
                  type="button"
                  onClick={() => selectCode(lang.code)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition ${
                    value === lang.code
                      ? 'bg-[var(--accent-soft)] font-semibold text-[var(--accent-primary)]'
                      : 'hover:bg-[var(--bg-surface-muted)]'
                  }`}
                >
                  <span className="truncate">{lang.name}</span>
                  <span className="font-mono text-xs opacity-75">{lang.code}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
