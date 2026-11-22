import React from 'react';
import { useI18n } from '../i18n/I18nContext';

export const Footer: React.FC = () => {
  const { t } = useI18n();
  return (
    <footer className="mt-12 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] py-5 text-center text-xs text-[var(--text-muted)]">
      <div className="mx-auto max-w-7xl px-4">{t('footerText')}</div>
    </footer>
  );
};
