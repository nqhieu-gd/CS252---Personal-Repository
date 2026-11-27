import React, { useCallback, useEffect, useState } from 'react';
import { DestinationGuidePanel } from './components/DestinationGuidePanel';
import { Footer } from './components/Footer';
import { HotelReviewsPanel } from './components/HotelReviewsPanel';
import { InquiryDeskPanel } from './components/InquiryDeskPanel';
import { LiveTranslatorPanel } from './components/LiveTranslatorPanel';
import { StatusBanner } from './components/StatusBanner';
import { TopBar } from './components/TopBar';
import { useTranslationHistory } from './hooks/useTranslationHistory';
import { apiClient } from './services/apiClient';
import type {
  HealthResponse,
  LanguageItem,
  ServicePresetKey,
  TravelSamplesResponse,
  WorkspaceTab,
} from './types/translate';

const FALLBACK_TRAVEL_LANGUAGES: LanguageItem[] = [
  { code: 'en', name: 'English' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'fr', name: 'French' },
  { code: 'es', name: 'Spanish' },
  { code: 'zh-cn', name: 'Chinese (Simplified)' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'th', name: 'Thai' },
];

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('translator');
  const [servicePreset, setServicePreset] = useState<ServicePresetKey>('default');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [travelLanguages, setTravelLanguages] =
    useState<LanguageItem[]>(FALLBACK_TRAVEL_LANGUAGES);
  const [allLanguages, setAllLanguages] = useState<LanguageItem[]>(FALLBACK_TRAVEL_LANGUAGES);
  const [samples, setSamples] = useState<TravelSamplesResponse>({
    destinations: [],
    reviews: [],
    inquiries: [],
    phrasebook: [],
  });
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const {
    history,
    addHistoryEntry,
    clearHistory,
    favorites,
    isFavorite,
    toggleFavorite,
    removeFavorite,
    clearFavorites,
  } = useTranslationHistory();

  const refreshHealth = useCallback(async () => {
    try {
      const h = await apiClient.getHealth();
      setHealth(h);
    } catch {
      setHealth(null);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const init = async () => {
      try {
        const [h, langs, samp] = await Promise.all([
          apiClient.getHealth(controller.signal),
          apiClient.getLanguages(controller.signal),
          apiClient.getTravelSamples(controller.signal),
        ]);
        setHealth(h);
        setTravelLanguages(langs.travel_languages);
        setAllLanguages(langs.all_languages);
        setSamples(samp);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setErrorBanner(
            'Could not reach FastAPI backend at /api. Make sure Uvicorn is running on port 8000.',
          );
        }
      }
    };
    void init();
    return () => controller.abort();
  }, []);

  const handleClearCache = async () => {
    try {
      await apiClient.clearCache();
      await refreshHealth();
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex min-h-screen flex-col text-[var(--text-primary)]">
      <TopBar activeTab={activeTab} onSelectTab={setActiveTab} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-7 sm:px-6">
        <StatusBanner error={errorBanner} onDismiss={() => setErrorBanner(null)} />

        {activeTab === 'translator' && (
          <LiveTranslatorPanel
            travelLanguages={travelLanguages}
            allLanguages={allLanguages}
            phrasebook={samples.phrasebook}
            servicePreset={servicePreset}
            history={history}
            favorites={favorites}
            isFavorite={isFavorite}
            onToggleFavorite={toggleFavorite}
            onRemoveFavorite={removeFavorite}
            onClearFavorites={clearFavorites}
            onAddHistory={addHistoryEntry}
            onClearHistory={clearHistory}
            onError={setErrorBanner}
            onOperationComplete={() => void refreshHealth()}
          />
        )}

        {activeTab === 'destinations' && (
          <DestinationGuidePanel
            destinations={samples.destinations}
            travelLanguages={travelLanguages}
            allLanguages={allLanguages}
            servicePreset={servicePreset}
            onError={setErrorBanner}
            onOperationComplete={() => void refreshHealth()}
          />
        )}

        {activeTab === 'reviews' && (
          <HotelReviewsPanel
            sampleReviews={samples.reviews}
            travelLanguages={travelLanguages}
            allLanguages={allLanguages}
            servicePreset={servicePreset}
            onError={setErrorBanner}
            onOperationComplete={() => void refreshHealth()}
          />
        )}

        {activeTab === 'inquiries' && (
          <InquiryDeskPanel
            sampleInquiries={samples.inquiries}
            travelLanguages={travelLanguages}
            allLanguages={allLanguages}
            servicePreset={servicePreset}
            onError={setErrorBanner}
            onOperationComplete={() => void refreshHealth()}
          />
        )}
      </main>

      <Footer
        servicePreset={servicePreset}
        onChangePreset={setServicePreset}
        health={health}
        onClearCache={() => void handleClearCache()}
      />
    </div>
  );
};

export default App;
