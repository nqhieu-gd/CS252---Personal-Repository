import React from 'react';
import { useI18n } from '../i18n/I18nContext';

export const Footer: React.FC = () => {
  const { t } = useI18n();
  return (
    <footer className="mt-14 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]/75 py-6 text-center text-sm font-medium text-[var(--text-muted)] backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4">{t('footerText')}</div>
    </footer>
  );
};
