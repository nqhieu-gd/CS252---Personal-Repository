import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface StatusBannerProps {
  error: string | null;
  onDismiss: () => void;
}

export const StatusBanner: React.FC<StatusBannerProps> = ({ error, onDismiss }) => {
  if (!error) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-red-400/40 bg-[var(--status-warning-bg)] px-5 py-3.5 text-base font-semibold text-[var(--status-warning-text)] shadow-xs"
    >
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span>{error}</span>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/10"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
};
