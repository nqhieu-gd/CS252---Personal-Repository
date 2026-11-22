import React, { createContext, useContext, useState } from 'react';
import type { Locale } from '../types/translate';
import { en, type TranslationKey } from './en';
import { vi } from './vi';

const STORAGE_KEY = 'wanderlingo_locale';

interface I18nContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === 'vi' ? 'vi' : 'en';
    } catch {
      return 'en';
    }
  });

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
  };

  const t = (key: TranslationKey): string => {
    const dict = locale === 'vi' ? vi : en;
    return dict[key] ?? en[key];
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
}
