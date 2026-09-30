// @ts-nocheck -- imported Bolt code, written for a looser TS config
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CloudSun,
  Loader2,
  AlertTriangle,
  Globe2,
  Radar,
  Layers,
  ClipboardList,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { SearchBar } from '@/modelcast/components/SearchBar';
import { CurrentWeatherCard } from '@/modelcast/components/CurrentWeatherCard';
import { TopModelForecast } from '@/modelcast/components/TopModelForecast';
import { WeatherModelsLiveModal } from '@/modelcast/components/WeatherModelsLiveModal';
import { LiveTrackersModal } from '@/modelcast/components/LiveTrackersModal';
import { WeatherLogs } from '@/modelcast/components/WeatherLogs';
import { SettingsBar } from '@/modelcast/components/SettingsBar';
import { SettingsProvider, useSettings } from '@/modelcast/lib/settings';
import { DayNightSummary } from '@/modelcast/components/DayNightSummary';
import type {
  CurrentWeather,
  DailyForecast,
  GeoLocation,
  HourlyForecast,
  ModelAccuracy,
  VoteAggregate,
  WeatherModel,
} from '@/modelcast/lib/types';
import {
  fetchCurrentWeather,
  fetchDailyForecast,
  fetchHourlyForecast,
} from '@/modelcast/lib/weatherApi';
import { supabase } from '@/modelcast/lib/supabase';
import { WEATHER_MODELS } from '@/modelcast/lib/weatherModels';
import { testModelAccuracy } from '@/modelcast/lib/accuracyApi';
import { useFavorites } from '@/modelcast/lib/useFavorites';
import { FavoritePlaces } from '@/modelcast/components/FavoritePlaces';

const LAST_LOCATION_KEY = 'modelcast:last-location';
const SELECTED_MODEL_KEY = 'modelcast:selected-model';

function AppContent() {
  const { t } = useSettings();
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [current, setCurrent] = useState<CurrentWeather | null>(null);
  const [hourly, setHourly] = useState<HourlyForecast | null>(null);
  const [daily, setDaily] = useState<DailyForecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModels, setShowModels] = useState(false);
  const [showTrackers, setShowTrackers] = useState(false);
  const [localVotes, setLocalVotes] = useState<VoteAggregate[]>([]);
  const [globalVotes, setGlobalVotes] = useState<VoteAggregate[]>([]);
  const [accuracyResults, setAccuracyResults] = useState<ModelAccuracy[]>([]);
  const [activeView, setActiveView] = useState<'forecast' | 'logs'>('forecast');
  const [refreshing, setRefreshing] = useState(false);
  const { favorites, addFavorite, removeFavorite, isFavorite } = useFavorites();
  const [restored, setRestored] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Model selection: 'auto' or specific model ID
  const [selectedModelId, setSelectedModelId] = useState<string>(() => {
    try {
      return localStorage.getItem(SELECTED_MODEL_KEY) || 'auto';
    } catch {
      return 'auto';
    }
  });

  const handleModelChange = useCallback((modelId: string) => {
    setSelectedModelId(modelId);
    try {
      localStorage.setItem(SELECTED_MODEL_KEY, modelId);
    } catch {
      // ignore
    }
  }, []);

  const loadWeather = useCallback(async (loc: GeoLocation, force = false) => {
    if (!force) setLoading(true);
    setError(null);
    try {
      const [cur, hr, dl] = await Promise.all([
        fetchCurrentWeather(loc.latitude, loc.longitude, force),
        fetchHourlyForecast(loc.latitude, loc.longitude, force),
        fetchDailyForecast(loc.latitude, loc.longitude, force),
      ]);
      setLastUpdated(new Date());
      setCurrent(cur);
      setHourly(hr);
      setDaily(dl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load weather data');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAccuracy = useCallback(async (loc: GeoLocation) => {
    try {
      const data = await testModelAccuracy(loc.latitude, loc.longitude);
      setAccuracyResults(data);
    } catch {
      setAccuracyResults([]);
    }
  }, []);

  const loadLocalVotes = useCallback(async (loc: GeoLocation) => {
    try {
      const { data, error } = await supabase
        .rpc('get_local_vote_aggregates', {
          lat: loc.latitude,
          lon: loc.longitude,
          radius: 0.5,
        });
      if (error) throw error;
      setLocalVotes((data ?? []) as VoteAggregate[]);
    } catch {
      setLocalVotes([]);
    }
  }, []);

  const loadGlobalVotes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_global_vote_aggregates');
      if (error) throw error;
      setGlobalVotes((data ?? []) as VoteAggregate[]);
    } catch {
      setGlobalVotes([]);
    }
  }, []);

  const handleSelect = useCallback(
    (loc: GeoLocation) => {
      setLocation(loc);
      loadWeather(loc);
      loadLocalVotes(loc);
      loadAccuracy(loc);
      try {
        localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(loc));
      } catch {
        // ignore
      }
    },
    [loadWeather, loadLocalVotes, loadAccuracy],
  );

  useEffect(() => {
    loadGlobalVotes();
  }, [loadGlobalVotes]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_LOCATION_KEY);
      if (raw) {
        const last = JSON.parse(raw) as GeoLocation;
        handleSelect(last);
      } else {
        handleSelect({
          id: 1150965,
          name: 'Ratchaburi',
          latitude: 13.54,
          longitude: 99.82,
          country: 'Thailand',
          admin1: 'Ratchaburi',
          timezone: 'Asia/Bangkok',
          country_code: 'TH',
        } as GeoLocation);
      }
    } catch {
      // ignore
    } finally {
      setRestored(true);
    }
  }, [handleSelect]);

  // Auto-refresh live weather every 10 minutes while open
  useEffect(() => {
    if (!location) return;
    const id = setInterval(() => {
      loadWeather(location, true);
      loadAccuracy(location);
    }, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [location, loadWeather, loadAccuracy]);

  const handleRefresh = useCallback(async () => {
    if (!location) return;
    setRefreshing(true);
    await Promise.all([
      loadWeather(location, true),
      loadLocalVotes(location),
      loadGlobalVotes(),
      loadAccuracy(location),
    ]);
    setRefreshing(false);
  }, [location, loadWeather, loadLocalVotes, loadGlobalVotes, loadAccuracy]);

  const topModel: WeatherModel = useMemo(() => {
    const scores = new Map<string, number>();

    for (const model of WEATHER_MODELS) {
      let combined = 0;
      let hasVote = false;
      let hasAccuracy = false;

      const localVote = localVotes.find((v) => v.model_id === model.id);
      const globalVote = globalVotes.find((v) => v.model_id === model.id);
      const accuracy = accuracyResults.find((a) => a.modelId === model.id && a.hasData);

      if (localVote && localVote.avg_rating > 0) {
        combined += (localVote.avg_rating / 5) * 50;
        hasVote = true;
      } else if (globalVote && globalVote.avg_rating > 0) {
        combined += (globalVote.avg_rating / 5) * 30;
        hasVote = true;
      }

      if (accuracy && accuracy.overallScore > 0) {
        combined += (accuracy.overallScore / 100) * 50;
        hasAccuracy = true;
      }

      if (hasVote || hasAccuracy) {
        scores.set(model.id, combined);
      }
    }

    const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      const found = WEATHER_MODELS.find((m) => m.id === sorted[0][0]);
      if (found) return found;
    }
    return WEATHER_MODELS[0];
  }, [localVotes, globalVotes, accuracyResults]);

  // Active weather model (either user selected or automatically top-ranked)
  const activeModel: WeatherModel = useMemo(() => {
    if (selectedModelId === 'auto') return topModel;
    return WEATHER_MODELS.find((m) => m.id === selectedModelId) ?? topModel;
  }, [selectedModelId, topModel]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 flex-wrap">
            <CloudSun className="text-sky-400" size={28} />
            <div>
              <h1 className="text-lg font-bold leading-tight text-white">ModelCast</h1>
              <p className="text-xs text-slate-400">{t('appTagline')}</p>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            {/* Quick Model Selector in Header */}
            <div className="flex items-center">
              <select
                value={selectedModelId}
                onChange={(e) => handleModelChange(e.target.value)}
                aria-label="Change Weather Model"
                className="h-8 max-w-[180px] truncate rounded-lg border border-slate-700 bg-slate-800/90 px-2 text-xs font-semibold text-sky-300 outline-none transition-colors hover:border-sky-500/70 focus:border-sky-400"
              >
                <option value="auto">⭐ Auto ({topModel.name})</option>
                <optgroup label="Select Weather Model">
                  {WEATHER_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.organization}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <SettingsBar />
            <button
              onClick={() => setActiveView(activeView === 'logs' ? 'forecast' : 'logs')}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                activeView === 'logs' ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <ClipboardList size={16} />
              <span>{activeView === 'logs' ? 'Forecast' : 'Logs'}</span>
            </button>
            <button
              onClick={() => void handleRefresh()}
              disabled={!location || refreshing}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => setShowTrackers(true)}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-red-500/90 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-400"
            >
              <Radar size={16} />
              <span>{t('liveTrackers')}</span>
            </button>
            <button
              onClick={() => setShowModels(true)}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-sky-400"
            >
              <Layers size={16} />
              <span>{t('weatherModelsLive')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="mb-8 text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            {t('findBest')}
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-slate-400">
            {t('findBestDesc', { count: WEATHER_MODELS.length })}
          </p>
          <div className="mt-6 flex justify-center">
            <SearchBar onSelect={handleSelect} currentLocation={location} />
          </div>
          {(favorites.length > 0 || (location && !isFavorite(location.id))) && (
            <div className="mt-4 flex justify-center">
              <FavoritePlaces
                favorites={favorites}
                currentLocation={location}
                isFavorite={isFavorite}
                onAdd={addFavorite}
                onRemove={removeFavorite}
                onSelect={handleSelect}
              />
            </div>
          )}
        </section>

        {!location && !loading && restored && (
          <div className="rounded-3xl border border-slate-700/50 bg-slate-800/40 p-8 text-center sm:p-12">
            <Globe2 size={48} className="mx-auto mb-4 text-slate-600" />
            <p className="text-lg font-medium text-slate-300">{t('searchToBegin')}</p>
            <p className="mt-1 text-sm text-slate-500">{t('searchHint')}</p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 size={40} className="animate-spin text-sky-400" />
            <p className="mt-4 text-slate-400">{t('fetchingForecasts')}</p>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <AlertTriangle size={40} className="mb-4 text-amber-400" />
            <p className="text-lg font-medium text-slate-300">{error}</p>
            <p className="mt-1 text-sm text-slate-500">{t('tryAnother')}</p>
          </div>
        )}

        {location && !loading && !error && current && hourly && daily && activeView === 'forecast' && (
          <div className="space-y-6">
            <CurrentWeatherCard
              weather={current}
              locationName={location.name}
              country={location.country}
            />
            {lastUpdated && (
              <p className="-mt-4 text-right text-xs text-slate-400">
                Last updated {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' })} ICT
              </p>
            )}

            {/* Weather Model Selector Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700/60 bg-gradient-to-r from-slate-800/90 via-slate-800/60 to-slate-800/90 p-3.5 shadow-lg backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-white shadow-inner"
                  style={{ backgroundColor: `${activeModel.color}25`, border: `1px solid ${activeModel.color}50` }}
                >
                  <span style={{ color: activeModel.color }} className="text-xs font-extrabold uppercase tracking-tight">
                    {activeModel.name.slice(0, 3)}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Weather Model
                    </span>
                    {selectedModelId === 'auto' ? (
                      <span className="rounded-full border border-amber-400/30 bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                        ★ #1 Auto Ranked
                      </span>
                    ) : (
                      <span className="rounded-full border border-sky-400/30 bg-sky-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                        Manual Override
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-white">
                    {activeModel.name} <span className="text-xs font-normal text-slate-400">({activeModel.organization})</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedModelId}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className="cursor-pointer rounded-xl border border-sky-500/50 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm outline-none transition hover:border-sky-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
                >
                  <option value="auto">⭐ Auto (Top Ranked: {topModel.name})</option>
                  <optgroup label="Select Specific Weather Model">
                    {WEATHER_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} — {m.organization} ({m.region})
                      </option>
                    ))}
                  </optgroup>
                </select>

                {selectedModelId !== 'auto' && (
                  <button
                    type="button"
                    onClick={() => handleModelChange('auto')}
                    className="flex items-center gap-1 rounded-xl bg-slate-700/70 px-2.5 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-slate-700 hover:text-amber-200"
                    title="Reset to automatically ranked top model"
                  >
                    <Sparkles size={13} />
                    <span>Reset Auto</span>
                  </button>
                )}
              </div>
            </div>

            {/* Day & Night Weather Report Summary */}
            <DayNightSummary
              location={location}
              current={current}
              hourly={hourly}
              daily={daily}
            />

            {/* Forecast using the active selected model */}
            <TopModelForecast
              location={location}
              model={activeModel}
              current={current}
              hourly={hourly}
              daily={daily}
              votes={localVotes}
              accuracy={accuracyResults}
              onOpenModels={() => setShowModels(true)}
            />
          </div>
        )}

        {location && !loading && !error && current && hourly && daily && activeView === 'logs' && (
          <WeatherLogs
            location={location}
            current={current}
          />
        )}
      </main>

      <footer className="border-t border-slate-800/80 py-6">
        <p className="text-center text-sm text-slate-500">{t('footerText')}</p>
      </footer>

      {location && hourly && daily && (
        <WeatherModelsLiveModal
          open={showModels}
          onClose={() => setShowModels(false)}
          location={location}
          localVotes={localVotes}
          globalVotes={globalVotes}
          accuracy={accuracyResults}
          onVoted={() => {
            loadLocalVotes(location);
            loadGlobalVotes();
          }}
        />
      )}

      <LiveTrackersModal open={showTrackers} onClose={() => setShowTrackers(false)} location={location} hourly={hourly} />
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  );
}
