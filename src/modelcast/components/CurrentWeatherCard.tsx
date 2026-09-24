import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudOff,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudSun,
  Sun,
  Droplets,
  Wind,
  Gauge,
  Thermometer,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CurrentWeather } from '@/modelcast/lib/types';
import { getWeatherCodeInfo } from '@/modelcast/lib/weatherCodes';
import { useSettings } from '@/modelcast/lib/settings';
import {
  formatTemp,
  formatTempWithUnit,
  formatWind,
  formatPrecip,
  formatPressure,
} from '@/modelcast/lib/units';

const ICON_MAP: Record<string, LucideIcon> = {
  Sun,
  CloudSun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudLightning,
  CloudOff,
};

function WeatherIcon({ code, size = 64, className }: { code: number; size?: number; className?: string }) {
  const info = getWeatherCodeInfo(code);
  const Icon = ICON_MAP[info.icon] ?? Cloud;
  return <Icon size={size} className={className} />;
}

interface CurrentWeatherCardProps {
  weather: CurrentWeather;
  locationName: string;
  country?: string;
}

export function CurrentWeatherCard({ weather, locationName, country }: CurrentWeatherCardProps) {
  const { t, units } = useSettings();
  const info = getWeatherCodeInfo(weather.weatherCode);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-700/50 bg-gradient-to-br from-slate-800/80 via-slate-800/60 to-sky-900/30 p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-12 -top-12 opacity-10">
        <WeatherIcon code={weather.weatherCode} size={200} />
      </div>

      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-sky-400">
            {t('currentConditions')}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-white">
            {locationName}
            {country ? <span className="text-lg font-normal text-slate-400"> · {country}</span> : null}
          </h2>
          <p className="mt-1 text-slate-300">{info.label}</p>
          <div className="mt-4 flex items-end gap-3">
            <span className="text-6xl font-extralight text-white">
              {formatTemp(weather.temperature, units)}
            </span>
            <span className="mb-2 text-2xl font-light text-slate-400">
              {units === 'us' ? '°F' : '°C'}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            {t('feelsLike')} {formatTempWithUnit(weather.apparentTemperature, units)}
          </p>
        </div>

        <div className="flex shrink-0 items-center justify-center">
          <div className="rounded-3xl bg-sky-500/10 p-6">
            <WeatherIcon code={weather.weatherCode} size={72} className="text-sky-300" />
          </div>
        </div>
      </div>

      <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric icon={<Droplets size={18} />} label={t('humidity')} value={`${weather.humidity}%`} />
        <Metric icon={<Wind size={18} />} label={t('wind')} value={formatWind(weather.windSpeed, units, 1)} />
        <Metric icon={<Gauge size={18} />} label={t('pressure')} value={formatPressure(weather.pressure, units)} />
        <Metric icon={<Thermometer size={18} />} label={t('precip')} value={formatPrecip(weather.precipitation, units, 1)} />
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-800/60 p-3">
      <div className="flex items-center gap-2 text-slate-400">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1 text-lg font-semibold text-slate-100">{value}</p>
    </div>
  );
}
