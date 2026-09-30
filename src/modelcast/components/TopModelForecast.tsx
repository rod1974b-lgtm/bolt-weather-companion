import React, { useState, useMemo, useEffect } from 'react';
import {
  Trophy,
  ChevronDown,
  ChevronUp,
  Sun,
  Moon,
  Droplets,
  Wind,
  Gauge,
  Eye,
  Umbrella,
  Flame,
  Sunrise,
  Sunset,
  Info,
  Layers,
  Compass,
} from 'lucide-react';
import type { WeatherData, WeatherModel, DailyForecastData } from '@/modelcast/lib/types';
import { WEATHER_MODELS } from '@/modelcast/lib/weatherModels';
import {
  formatTemp,
  formatWindSpeed,
  formatPrecip,
  formatPressure,
  formatVisibility,
  getTempUnit,
  getWindSpeedUnit,
  getPrecipUnit,
  getPressureUnit,
  getVisibilityUnit,
} from '@/modelcast/lib/units';
import { getWeatherDescription } from '@/modelcast/lib/weatherCodes';
import { useSettings } from '@/modelcast/lib/settings';

const STORAGE_KEY = 'modelcast_selected_model';

interface TopModelForecastProps {
  model: WeatherModel;
  data: WeatherData;
  voteAgg?: { averageRating: number; totalVotes: number };
  accuracyAgg?: { accuracyScore: number; rank: number };
  onOpenModelModal: () => void;
  onOpenAllModelsModal?: () => void;
}

export default function TopModelForecast({
  model: autoModel,
  data,
  voteAgg,
  accuracyAgg,
  onOpenModelModal,
  onOpenAllModelsModal,
}: TopModelForecastProps) {
  const { settings } = useSettings();
  const [selectedModelId, setSelectedModelId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY) || 'auto';
    }
    return 'auto';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, selectedModelId);
    }
  }, [selectedModelId]);

  const activeModel = useMemo(() => {
    if (selectedModelId === 'auto') return autoModel;
    return WEATHER_MODELS.find((m) => m.id === selectedModelId) ?? autoModel;
  }, [selectedModelId, autoModel]);

  const currentHourIndex = useMemo(() => {
    const now = new Date();
    return Math.min(now.getHours(), 23);
  }, []);

  const modelHourly = data.hourly?.models?.[activeModel.id];
  const modelDaily = data.daily?.models?.[activeModel.id];

  const currentTemp = modelHourly?.temperature_2m?.[currentHourIndex] ?? 0;
  const currentApparentTemp = modelHourly?.apparent_temperature?.[currentHourIndex] ?? currentTemp;
  const currentPrecip = modelHourly?.precipitation?.[currentHourIndex] ?? 0;
  const currentPrecipProb = modelHourly?.precipitation_probability?.[currentHourIndex] ?? 0;
  const currentWindSpeed = modelHourly?.wind_speed_10m?.[currentHourIndex] ?? 0;
  const currentHumidity = modelHourly?.relative_humidity_2m?.[currentHourIndex] ?? 0;
  const currentPressure = modelHourly?.surface_pressure?.[currentHourIndex] ?? 1013;
  const currentVisibility = modelHourly?.visibility?.[currentHourIndex] ?? 10000;
  const currentUvIndex = modelHourly?.uv_index?.[currentHourIndex] ?? 0;
  const currentWeatherCode = modelHourly?.weather_code?.[currentHourIndex] ?? 0;

  const weatherDesc = getWeatherDescription(currentWeatherCode);

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-gradient-to-b from-slate-800/90 to-slate-900/90 p-5 shadow-xl backdrop-blur-sm sm:p-6">
      {/* Header bar */}
      <div className="flex flex-col gap-4 border-b border-slate-700/60 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-inner"
            style={{ backgroundColor: `${activeModel.color}25`, border: `1.5px solid ${activeModel.color}60` }}
          >
            <Trophy className="h-6 w-6" style={{ color: activeModel.color }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              {selectedModelId === 'auto' && (
                <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-amber-300 ring-1 ring-amber-400/30">
                  Auto #1
                </span>
              )}
              <div className="relative">
                <select
                  value={selectedModelId}
                  onChange={(e) => setSelectedModelId(e.target.value)}
                  className="cursor-pointer appearance-none rounded-lg border border-slate-700 bg-slate-800/90 py-1 pl-2.5 pr-8 text-sm font-semibold text-slate-100 hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="auto">⭐ Auto (Top Ranked: {autoModel.name})</option>
                  <optgroup label="Choose a model">
                    {WEATHER_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} — {m.organization}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              {activeModel.region} · {activeModel.resolution}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenAllModelsModal && (
            <button
              onClick={onOpenAllModelsModal}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700/60 hover:text-white"
            >
              <Layers className="h-3.5 w-3.5 text-sky-400" />
              Weather Models Live
            </button>
          )}
          <button
            onClick={onOpenModelModal}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700/60 hover:text-white"
          >
            <Info className="h-3.5 w-3.5 text-slate-400" />
            Model Details
          </button>
        </div>
      </div>

      {/* Main stats */}
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        <div className="rounded-xl border border-slate-700/40 bg-slate-800/40 p-3.5">
          <div className="text-xs text-slate-400">Temperature</div>
          <div className="mt-1 text-2xl font-bold text-white">
            {formatTemp(currentTemp, settings.tempUnit)}
            <span className="text-sm font-normal text-slate-400">{getTempUnit(settings.tempUnit)}</span>
          </div>
          <div className="text-xs text-slate-500">
            Feels like {formatTemp(currentApparentTemp, settings.tempUnit)}
            {getTempUnit(settings.tempUnit)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-700/40 bg-slate-800/40 p-3.5">
          <div className="text-xs text-slate-400">Condition</div>
          <div className="mt-1 truncate text-base font-semibold text-white">{weatherDesc}</div>
          <div className="text-xs text-slate-500">Code: {currentWeatherCode}</div>
        </div>

        <div className="rounded-xl border border-slate-700/40 bg-slate-800/40 p-3.5">
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Umbrella className="h-3.5 w-3.5 text-sky-400" /> Precip
          </div>
          <div className="mt-1 text-xl font-bold text-white">
            {formatPrecip(currentPrecip, settings.precipUnit)}
            <span className="text-xs font-normal text-slate-400"> {getPrecipUnit(settings.precipUnit)}</span>
          </div>
          <div className="text-xs text-slate-500">{currentPrecipProb}% probability</div>
        </div>

        <div className="rounded-xl border border-slate-700/40 bg-slate-800/40 p-3.5">
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Wind className="h-3.5 w-3.5 text-teal-400" /> Wind
          </div>
          <div className="mt-1 text-xl font-bold text-white">
            {formatWindSpeed(currentWindSpeed, settings.windSpeedUnit)}
            <span className="text-xs font-normal text-slate-400"> {getWindSpeedUnit(settings.windSpeedUnit)}</span>
          </div>
          <div className="text-xs text-slate-500">Humidity: {currentHumidity}%</div>
        </div>

        <div className="rounded-xl border border-slate-700/40 bg-slate-800/40 p-3.5">
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Gauge className="h-3.5 w-3.5 text-indigo-400" /> Pressure
          </div>
          <div className="mt-1 text-xl font-bold text-white">
            {formatPressure(currentPressure, settings.pressureUnit)}
            <span className="text-xs font-normal text-slate-400"> {getPressureUnit(settings.pressureUnit)}</span>
          </div>
          <div className="text-xs text-slate-500">
            UV: {currentUvIndex} · Vis: {formatVisibility(currentVisibility, settings.visibilityUnit)}
            {getVisibilityUnit(settings.visibilityUnit)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-700/40 bg-slate-800/40 p-3.5">
          <div className="text-xs text-slate-400">Accuracy & Votes</div>
          <div className="mt-1 text-xl font-bold text-emerald-400">
            {accuracyAgg?.accuracyScore != null ? `${accuracyAgg.accuracyScore}%` : '—'}
          </div>
          <div className="text-xs text-slate-500">
            {voteAgg ? `★ ${voteAgg.averageRating.toFixed(1)} (${voteAgg.totalVotes})` : 'No votes yet'}
          </div>
        </div>
      </div>
    </div>
  );
}
