import { useCallback, useState } from 'react';
import { MAX_HISTORY_ITEMS } from '../config/apiConfig';
import type { TranslationHistoryEntry } from '../types/translate';

const STORAGE_KEY = 'wanderlingo_history_v1';

export function useTranslationHistory() {
  const [history, setHistory] = useState<TranslationHistoryEntry[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as TranslationHistoryEntry[]) : [];
    } catch {
      return [];
    }
  });

  const addHistoryEntry = useCallback(
    (entry: Omit<TranslationHistoryEntry, 'id' | 'timestampIso'>) => {
      setHistory((prev) => {
        const filtered = prev.filter(
          (item) => !(item.origin === entry.origin && item.dest === entry.dest),
        );
        const nextItem: TranslationHistoryEntry = {
          ...entry,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestampIso: new Date().toISOString(),
        };
        const updated = [nextItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // ignore storage quota errors
        }
        return updated;
      });
    },
    [],
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { history, addHistoryEntry, clearHistory };
}
