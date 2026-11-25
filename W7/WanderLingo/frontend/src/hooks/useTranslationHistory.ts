import { useCallback, useState } from 'react';
import { MAX_FAVORITE_ITEMS, MAX_HISTORY_ITEMS } from '../config/apiConfig';
import type { TranslationHistoryEntry } from '../types/translate';

const HISTORY_KEY = 'wanderlingo_history_v1';
const FAVORITES_KEY = 'wanderlingo_favorites_v1';

function readStoredList(key: string): TranslationHistoryEntry[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as TranslationHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function useTranslationHistory() {
  const [history, setHistory] = useState<TranslationHistoryEntry[]>(() =>
    readStoredList(HISTORY_KEY),
  );
  const [favorites, setFavorites] = useState<TranslationHistoryEntry[]>(() =>
    readStoredList(FAVORITES_KEY),
  );

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
          localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
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
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      // ignore
    }
  }, []);

  const isFavorite = useCallback(
    (origin: string, dest: string) =>
      favorites.some((f) => f.origin === origin && f.dest === dest),
    [favorites],
  );

  const toggleFavorite = useCallback(
    (entry: Omit<TranslationHistoryEntry, 'id' | 'timestampIso'>) => {
      setFavorites((prev) => {
        const exists = prev.some(
          (item) => item.origin === entry.origin && item.dest === entry.dest,
        );
        const updated = exists
          ? prev.filter((item) => !(item.origin === entry.origin && item.dest === entry.dest))
          : [
              {
                ...entry,
                id: `fav-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                timestampIso: new Date().toISOString(),
              },
              ...prev,
            ].slice(0, MAX_FAVORITE_ITEMS);
        try {
          localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });
    },
    [],
  );

  const clearFavorites = useCallback(() => {
    setFavorites([]);
    try {
      localStorage.removeItem(FAVORITES_KEY);
    } catch {
      // ignore
    }
  }, []);

  return {
    history,
    addHistoryEntry,
    clearHistory,
    favorites,
    isFavorite,
    toggleFavorite,
    clearFavorites,
  };
}
