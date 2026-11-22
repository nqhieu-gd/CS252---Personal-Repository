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
      className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-400/40 bg-[var(--status-warning-bg)] px-4 py-3 text-xs font-medium text-[var(--status-warning-text)] sm:text-sm"
    >
      <div className="flex items-center gap-2.5">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>{error}</span>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="rounded-lg p-1 hover:bg-black/10"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
