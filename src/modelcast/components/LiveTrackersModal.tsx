import { useState, useEffect, useRef } from 'react';
import type { GeoLocation, HourlyForecast } from '@/modelcast/lib/types';
import { supabaseUrl } from '@/modelcast/lib/supabase';
import { fetchPrecipitationNearby, fetchTropicalStorms, haversineKm } from '@/modelcast/lib/liveTrackers';
import type { TropicalStorm } from '@/modelcast/lib/liveTrackers';
import { X, Satellite, Wind, Zap, ExternalLink, Loader2, AlertTriangle, Clock, CheckCircle2, Info } from 'lucide-react';

type TabId = 'precip' | 'warnings' | 'satellite' | 'earthquake' | 'hurricane' | 'lightning';
type LightningRegion = 'nearby' | 'asia' | 'europe' | 'americas' | 'global';

type EarthquakeFeature = {
  id: string;
  properties: { place?: string; mag?: number; time?: number };
  geometry: { coordinates: [number, number, number] };
};

interface WeatherAlertData {
  id: string;
  area: string;
  alertType: string;
  severity: string;
  certainty: string;
  onset: string;
  expires: string;
  description: string;
  instruction: string;
  source?: string;
}

function formatAlertTime(iso: string): string {
  if (!iso) return 'Unknown';
  try {
    return new Date(iso).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function severityColor(severity: string): { bg: string; border: string; text: string } {
  const s = severity.toLowerCase();
  if (s === 'extreme') return { bg: 'bg-red-500/15', border: 'border-red-500/40', text: 'text-red-300' };
  if (s === 'severe') return { bg: 'bg-orange-500/15', border: 'border-orange-500/40', text: 'text-orange-300' };
  if (s === 'moderate') return { bg: 'bg-amber-500/15', border: 'border-amber-500/40', text: 'text-amber-300' };
  if (s === 'minor') return { bg: 'bg-yellow-500/15', border: 'border-yellow-500/40', text: 'text-yellow-300' };
  return { bg: 'bg-sky-500/15', border: 'border-sky-500/40', text: 'text-sky-300' };
}

function WarningsTracker({ location }: { location: GeoLocation | null }) {
  const [alerts, setAlerts] = useState<WeatherAlertData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lat = location?.latitude ?? 13.9642;
  const lon = location?.longitude ?? 99.9445;

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    const url = `${supabaseUrl}/functions/v1/weather-alerts?lat=${lat}&lon=${lon}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        if (data.error && (!data.alerts || data.alerts.length === 0)) {
          setError(data.error);
          setAlerts([]);
        } else {
          setAlerts(data.alerts ?? []);
        }
      })
      .catch(() => {
        if (!mounted) return;
        setError('Failed to fetch weather alerts');
        setAlerts([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [lat, lon]);

  const locName = location?.name ?? 'this area';

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Loader2 size={24} className="animate-spin mb-3" />
        <span className="text-sm">Fetching live weather alerts for {locName}...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle size={18} className="text-amber-400" />
        <h3 className="text-white font-bold text-sm">Severe Weather Warnings &bull; {locName}</h3>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
          {alerts.length} {alerts.length === 1 ? 'warning' : 'warnings'} &bull; Live
        </span>
      </div>

      {error && alerts.length === 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
          <div className="flex items-center gap-2 text-amber-300 text-sm mb-1">
            <Info size={16} />
            <span className="font-medium">Alerts temporarily unavailable</span>
          </div>
          <p className="text-xs text-slate-400">{error}</p>
          <p className="text-xs text-slate-500 mt-2">Alerts are generated from live forecast data and official meteorological sources when available.</p>
        </div>
      )}

      {alerts.length === 0 && !error && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-8 text-center">
          <CheckCircle2 size={40} className="mx-auto text-green-400 mb-3" />
          <p className="text-sm font-medium text-slate-200">No active weather alerts for {locName}</p>
          <p className="text-xs text-slate-500 mt-1">This area is clear of severe weather warnings right now.</p>
        </div>
      )}

      {alerts.map((a) => {
        const colors = severityColor(a.severity);
        return (
          <div key={a.id} className={`rounded-xl border ${colors.border} ${colors.bg} overflow-hidden shadow-lg`}>
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className={`w-12 h-12 rounded-full ${colors.bg} flex items-center justify-center flex-shrink-0 border ${colors.border}`}>
                  <AlertTriangle size={20} className={colors.text} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h4 className="text-white font-bold text-[13px]">{a.alertType}</h4>
                      <p className="text-slate-400 text-xs">{a.area}</p>
                    </div>
                    <span className={`px-3 py-1 rounded border ${colors.border} ${colors.text} text-xs ${colors.bg} whitespace-nowrap font-medium capitalize`}>{a.severity}</span>
                  </div>
                  {(a.onset || a.expires) && (
                    <div className="mt-3 text-xs text-slate-300 bg-slate-800/50 rounded px-2 py-1.5 flex items-center gap-1.5">
                      <Clock size={12} className="text-slate-400 flex-shrink-0" />
                      <span className="text-[11px] leading-tight">
                        {a.onset && <>From <b>{formatAlertTime(a.onset)}</b></>}
                        {a.onset && a.expires && ' '}
                        {a.expires && <>until <b>{formatAlertTime(a.expires)}</b></>}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {a.description && (
                <div className="mt-4">
                  <h5 className="text-white font-bold text-xs mb-2">Description</h5>
                  <div className="rounded border border-slate-600 p-3 bg-[#2a3648]/70">
                    <p className="text-slate-200 text-xs leading-relaxed whitespace-pre-line">{a.description}</p>
                  </div>
                </div>
              )}

              {a.instruction && (
                <div className="mt-3">
                  <h5 className="text-white font-bold text-xs mb-2">Instructions</h5>
                  <div className="rounded border border-slate-600 p-3 bg-[#2a3648]/70">
                    <p className="text-slate-200 text-xs leading-relaxed whitespace-pre-line">{a.instruction}</p>
                  </div>
                </div>
              )}

              <div className="mt-3 space-y-1 text-[11px] text-slate-400 border-t border-slate-700/50 pt-3">
                <div>Source: <span className="text-slate-300">{a.source ?? 'Open-Meteo forecast data'}</span></div>
                <div>Certainty: <span className="text-slate-300">{a.certainty}</span></div>
              </div>
            </div>
          </div>
        );
      })}

      <div className="rounded-lg bg-slate-800 border border-slate-700 p-3 text-[11px] text-slate-400 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        Live alerts from Open-Meteo forecast + official TMD warnings (Thailand) &bull; updates when you open this tab
      </div>
    </div>
  );
}

interface PrecipHour {
  time: string;
  precip: number;
  prob: number;
  dateKey: string;
  hour: number;
  isPast: boolean;
  isNow: boolean;
}

function precipBarColor(mm: number): string {
  if (mm >= 5) return '#1d4ed8';
  if (mm >= 2) return '#2563eb';
  if (mm >= 0.5) return '#3b82f6';
  if (mm > 0) return '#60a5fa';
  return '#334155';
}

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function PrecipitationTracker({ location }: { location: GeoLocation | null }) {
  const lat = location?.latitude ?? 13.9642;
  const lon = location?.longitude ?? 99.9445;
  const locName = location?.name ?? 'this area';

  const [hours, setHours] = useState<PrecipHour[]>([]);
  const [currentPrecip, setCurrentPrecip] = useState(0);
  const [currentProb, setCurrentProb] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const fetchData = async () => {
      if (!mounted) return;
      setError(null);
      try {
        const result = await fetchPrecipitationNearby(lat, lon);
        if (!mounted) return;

        const now = Date.now();
        const allHours: PrecipHour[] = result.timeline.map((time, i) => {
          const d = new Date(time);
          return {
            time,
            precip: result.precipitation[i] ?? 0,
            prob: result.probability[i] ?? 0,
            dateKey: localDateKey(d),
            hour: d.getHours(),
            isPast: d.getTime() < now,
            isNow: false,
          };
        });

        let minDiff = Infinity;
        let nowIdx = -1;
        for (let i = 0; i < allHours.length; i++) {
          const diff = Math.abs(new Date(allHours[i].time).getTime() - now);
          if (diff < minDiff) {
            minDiff = diff;
            nowIdx = i;
          }
        }
        if (nowIdx >= 0) allHours[nowIdx].isNow = true;

        if (allHours.length === 0) throw new Error('No precipitation data available for this location');
        setHours(allHours);
        if (nowIdx >= 0) {
          setCurrentPrecip(allHours[nowIdx].precip);
          setCurrentProb(allHours[nowIdx].prob);
        }
        setLastUpdated(new Date());
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to fetch precipitation data');
        setHours([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    setLoading(true);
    void fetchData();
    timer = setInterval(() => void fetchData(), 5 * 60 * 1000);
    return () => { mounted = false; if (timer) clearInterval(timer); };
  }, [lat, lon]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Loader2 size={24} className="animate-spin mb-3" />
        <span className="text-sm">Fetching live precipitation data for {locName}...</span>
      </div>
    );
  }

  const maxPrecip = Math.max(2, ...hours.map(h => h.precip));
  const yMax = Math.ceil(maxPrecip);
  const yTicks = 5;
  const tickStep = yMax / (yTicks - 1);

  const numHours = hours.length;
  const barSlot = 7;
  const chartW = numHours * barSlot;
  const W = chartW + 50 + 14;
  const H = 320;
  const padL = 50;
  const padR = 14;
  const padT = 38;
  const padB = 28;
  const plotH = H - padT - padB;

  const dayGroups: { dateKey: string; label: string; startIdx: number; endIdx: number }[] = [];
  for (let i = 0; i < hours.length; i++) {
    const d = new Date(hours[i].time);
    const label = d.toLocaleDateString('en', { weekday: 'short', day: 'numeric' });
    const last = dayGroups[dayGroups.length - 1];
    if (last && last.dateKey === hours[i].dateKey) {
      last.endIdx = i;
    } else {
      dayGroups.push({ dateKey: hours[i].dateKey, label, startIdx: i, endIdx: i });
    }
  }

  const nowIdx = hours.findIndex(h => h.isNow);
  const nextRain = nowIdx >= 0 ? hours.find((h, i) => i > nowIdx && h.precip > 0.1) : undefined;
  const totalForecast = hours.slice(nowIdx >= 0 ? nowIdx : 0).reduce((sum, h) => sum + h.precip, 0);

  const xForIdx = (i: number) => padL + i * barSlot + barSlot / 2;
  const yForVal = (v: number) => padT + plotH - (v / yMax) * plotH;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-slate-300 font-medium">LIVE &bull; Open-Meteo &bull; {locName}</span>
        </div>
        {lastUpdated && (
          <span className="text-[10px] text-slate-500 ml-auto">
            Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull; auto-refresh 5min
          </span>
        )}
      </div>

      {error && hours.length === 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
          <div className="flex items-center gap-2 text-amber-300 text-sm mb-1">
            <Info size={16} />
            <span className="font-medium">Precipitation data unavailable</span>
          </div>
          <p className="text-xs text-slate-400">{error}</p>
        </div>
      )}

      {hours.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3">
              <div className="text-[10px] text-slate-400 uppercase tracking-wide">Right Now</div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-sky-300">{currentPrecip.toFixed(1)}</span>
                <span className="text-xs text-slate-400">mm</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">{currentProb}% prob</div>
            </div>
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3">
              <div className="text-[10px] text-slate-400 uppercase tracking-wide">Next Rain</div>
              {nextRain ? (
                <div className="mt-1">
                  <span className="text-xl font-bold text-sky-300">{new Date(nextRain.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <div className="text-[10px] text-slate-500 mt-0.5">{nextRain.precip.toFixed(1)} mm &bull; {nextRain.prob}%</div>
                </div>
              ) : (
                <div className="mt-1">
                  <span className="text-base font-bold text-green-400">Clear</span>
                  <div className="text-[10px] text-slate-500 mt-0.5">No rain in forecast</div>
                </div>
              )}
            </div>
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3">
              <div className="text-[10px] text-slate-400 uppercase tracking-wide">3-Day Total</div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-sky-300">{totalForecast.toFixed(1)}</span>
                <span className="text-xs text-slate-400">mm</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">forecast total</div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700/50 bg-[#1a2332]/90 p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-white font-bold text-sm">Estimated Precipitation &bull; {locName}</h3>
              <div className="flex items-center gap-3 text-[10px] text-slate-400">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#60a5fa' }} /> Light</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#2563eb' }} /> Moderate</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#1d4ed8' }} /> Heavy</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: 600, width: '100%' }}>
                {dayGroups.map((dg, i) => {
                  const x1 = padL + dg.startIdx * barSlot;
                  const x2 = padL + (dg.endIdx + 1) * barSlot;
                  return (
                    <g key={i}>
                      <rect x={x1} y={padT} width={x2 - x1} height={plotH} fill={i % 2 === 0 ? 'rgba(30,41,59,0.35)' : 'rgba(30,41,59,0.12)'} />
                      <text x={(x1 + x2) / 2} y={padT - 10} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 11, fontWeight: 600 }}>{dg.label}</text>
                      {i > 0 && <line x1={x1} y1={padT} x2={x1} y2={padT + plotH} stroke="#334155" strokeWidth={0.5} strokeDasharray="2 3" />}
                    </g>
                  );
                })}

                {Array.from({ length: yTicks }, (_, i) => {
                  const val = i * tickStep;
                  const y = yForVal(val);
                  return (
                    <g key={i}>
                      <line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke="#334155" strokeWidth={0.4} strokeDasharray="3 4" />
                      <text x={padL - 8} y={y + 3.5} textAnchor="end" className="fill-slate-500" style={{ fontSize: 10 }}>{val.toFixed(1)}</text>
                    </g>
                  );
                })}

                <text x={14} y={padT + plotH / 2} textAnchor="middle" transform={`rotate(-90 14 ${padT + plotH / 2})`} className="fill-slate-500" style={{ fontSize: 10 }}>mm</text>

                {hours.map((h, i) => {
                  const barH = h.precip > 0 ? Math.max(1.5, (h.precip / yMax) * plotH) : 0;
                  const bw = barSlot * 0.65;
                  const bx = padL + i * barSlot + (barSlot - bw) / 2;
                  const by = padT + plotH - barH;
                  return (
                    <g key={i}>
                      <rect x={bx} y={by} width={bw} height={barH} rx={0.5} fill={precipBarColor(h.precip)} opacity={h.isPast ? 0.5 : 0.9} />
                      {h.prob > 0 && h.precip > 0.1 && (
                        <text x={padL + i * barSlot + barSlot / 2} y={by - 3} textAnchor="middle" className="fill-sky-300" style={{ fontSize: 7, fontWeight: 600 }}>{h.prob}</text>
                      )}
                    </g>
                  );
                })}

                {nowIdx >= 0 && (
                  <g>
                    <line x1={xForIdx(nowIdx)} y1={padT - 4} x2={xForIdx(nowIdx)} y2={padT + plotH} stroke="#f97316" strokeWidth={1.2} strokeDasharray="4 3" />
                    <rect x={xForIdx(nowIdx) - 14} y={padT - 18} width={28} height={13} rx={3} fill="#f97316" />
                    <text x={xForIdx(nowIdx)} y={padT - 8} textAnchor="middle" fill="#fff" style={{ fontSize: 9, fontWeight: 700 }}>Now</text>
                  </g>
                )}

                {hours.map((h, i) => {
                  if (h.hour % 6 !== 0) return null;
                  return (
                    <text key={i} x={padL + i * barSlot + barSlot / 2} y={H - 8} textAnchor="middle" className="fill-slate-500" style={{ fontSize: 9 }}>
                      {String(h.hour).padStart(2, '0')}:00
                    </text>
                  );
                })}
              </svg>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 px-1 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live precipitation from Open-Meteo &bull; hourly resolution &bull; 1 day past + 3 day forecast &bull; auto-refreshes every 5 minutes
          </div>
        </>
      )}
    </div>
  );
}

function SatelliteTracker() {
  const [active, setActive] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const SATS = [
    { id: 'goes-east', name: 'GOES East - Americas', imageUrl: 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/FD/GEOCOLOR/latest.jpg', mapUrl: 'https://zoom.earth/#view=0,0,3z/map=satellite' },
    { id: 'goes-west', name: 'GOES West - Pacific', imageUrl: 'https://cdn.star.nesdis.noaa.gov/GOES18/ABI/FD/GEOCOLOR/latest.jpg', mapUrl: 'https://zoom.earth/#view=0,-150,3z/map=satellite' },
    { id: 'himawari', name: 'Himawari - Thailand/Asia', imageUrl: 'https://cdn.star.nesdis.noaa.gov/HIMAWARI9/ABI/FD/GEOCOLOR/latest.jpg', mapUrl: 'https://zoom.earth/#view=13.96,99.94,5z/map=satellite' },
    { id: 'jma', name: 'Japan JMA - Asia', imageUrl: 'https://cdn.star.nesdis.noaa.gov/HIMAWARI9/ABI/FD/GEOCOLOR/latest.jpg', mapUrl: 'https://zoom.earth/#view=36,138,5z/map=satellite' },
    { id: 'meteosat', name: 'Meteosat - Europe/Africa', imageUrl: 'https://www.ospo.noaa.gov/eumet/eatl/rgb.jpg', mapUrl: 'https://www.ospo.noaa.gov/products/imagery/meteosat.html' },
  ];
  const current = SATS[active];

  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
  }, [active]);

  useEffect(() => {
    const timer = setInterval(() => setRefreshTick((tick) => tick + 1), 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const imageUrl = `${current.imageUrl}?t=${refreshTick}`;

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {SATS.map((s, i) => (
          <button key={s.id} onClick={() => setActive(i)} className={active === i ? 'px-3 py-1.5 rounded-full text-xs bg-sky-500 text-white border border-sky-400 shadow' : 'px-3 py-1.5 rounded-full text-xs bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600'}>{s.name}</button>
        ))}
      </div>
      <div className="relative bg-black rounded-xl overflow-hidden aspect-video min-h-[480px] border border-slate-700 flex items-center justify-center">
        {!imageLoaded && !imageError && <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 z-10 bg-slate-900"><Loader2 size={32} className="animate-spin mb-3 text-sky-400" /><span className="text-sm">Loading live satellite image...</span></div>}
        {imageError ? (
          <div className="flex flex-col items-center justify-center text-center text-slate-300 p-8"><Satellite size={40} className="mb-3 text-sky-400" /><p className="text-sm font-medium">Satellite image temporarily unavailable</p><p className="text-xs text-slate-500 mt-2">Open the live map to view current imagery.</p></div>
        ) : (
          <img key={imageUrl} src={imageUrl} alt={`${current.name} live satellite`} className={`w-full h-full min-h-[480px] object-contain bg-black transition-opacity ${imageLoaded ? 'opacity-100' : 'opacity-0'}`} onLoad={() => setImageLoaded(true)} onError={() => setImageError(true)} />
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[10px] text-slate-400 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />Live NOAA imagery &bull; refreshes every 10 minutes &bull; {current.name}</span>
        <a href={current.mapUrl} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-full bg-sky-600 text-white text-xs flex items-center gap-1 hover:bg-sky-500">Open Full Map <ExternalLink size={10} /></a>
      </div>
    </div>
  );
}

function EarthquakeTracker({ location }: { location: GeoLocation | null }) {
  const [quakes, setQuakes] = useState<EarthquakeFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const lat = location?.latitude ?? 13.9642;
  const lon = location?.longitude ?? 99.9445;
  useEffect(() => {
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=${lat}&longitude=${lon}&maxradiuskm=1000&minmagnitude=2.5&limit=20&orderby=time`;
    fetch(url).then(r => r.json()).then(d => setQuakes(d.features || [])).finally(() => setLoading(false));
  }, [lat, lon]);
  if (loading) return <div className="flex justify-center py-20 text-slate-400"><Loader2 className="animate-spin mr-2" />Loading USGS earthquakes near Ratchaburi...</div>;
  return (
    <div className="space-y-2 max-h-[520px] overflow-y-auto">
      <div className="text-[11px] text-slate-400 mb-2 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500" />USGS live - 1000km around Ratchaburi - M2.5+</div>
      {quakes.length === 0 && <div className="text-center text-slate-400 text-sm py-10">✓ No earthquakes &gt;2.5 within 1000km recently - Ratchaburi area clear</div>}
      {quakes.map((f) => (
        <div key={f.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-600">
          <div><div className="text-sm text-white font-medium">{f.properties.place}</div><div className="text-xs text-slate-400">M {f.properties.mag} • {new Date(f.properties.time ?? 0).toLocaleString()} • {f.geometry.coordinates[2]}km deep</div></div>
          <a href={`https://earthquake.usgs.gov/earthquakes/eventpage/${f.id}`} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white p-2"><ExternalLink size={16} /></a>
        </div>
      ))}
    </div>
  );
}

function HurricaneTracker({ location }: { location: GeoLocation | null }) {
  const [storms, setStorms] = useState<TropicalStorm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lat = location?.latitude ?? 13.9642;
  const lon = location?.longitude ?? 99.9445;

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    fetchTropicalStorms()
      .then((data) => {
        if (!mounted) return;
        setStorms(data);
      })
      .catch(() => {
        if (!mounted) return;
        setError('Failed to fetch storm data');
        setStorms([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const stormsWithDistance = storms
    .map((s) => ({
      ...s,
      distanceKm: haversineKm(lat, lon, s.latitude, s.longitude),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const nearbyStorms = stormsWithDistance.filter((s) => s.distanceKm < 3000);
  const otherStorms = stormsWithDistance.filter((s) => s.distanceKm >= 3000);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 min-h-[600px] flex flex-col overflow-hidden">
      <div className="p-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
        <span className="text-sm text-white font-bold flex items-center gap-2"><Wind size={16} className="text-sky-400" />Hurricane &amp; Typhoon Tracker LIVE</span>
        <span className="text-[10px] px-2 py-1 rounded-full bg-green-500/20 text-green-300 border border-green-500/30">
          {loading ? 'Loading...' : `${storms.length} active`}
        </span>
      </div>
      <div className="flex-1 p-3 bg-slate-900 space-y-3 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-xl overflow-hidden border border-slate-700 bg-black">
            <div className="p-2 bg-slate-800 text-xs text-white font-medium flex items-center justify-between"><span>Atlantic &bull; NHC</span><a href="https://www.nhc.noaa.gov/" target="_blank" rel="noreferrer" className="text-sky-400"><ExternalLink size={12} /></a></div>
            <img src="https://www.nhc.noaa.gov/xgtwo/two_atl_0d0.png" alt="Atlantic Tropical Outlook" className="w-full h-[260px] object-contain bg-slate-900" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <div className="p-2 text-[10px] text-slate-400">Atlantic 2-day tropical outlook - updates every 6h</div>
          </div>
          <div className="rounded-xl overflow-hidden border border-slate-700 bg-black">
            <div className="p-2 bg-slate-800 text-xs text-white font-medium flex items-center justify-between"><span>East Pacific &bull; NHC</span><a href="https://www.nhc.noaa.gov/?epac" target="_blank" rel="noreferrer" className="text-sky-400"><ExternalLink size={12} /></a></div>
            <img src="https://www.nhc.noaa.gov/xgtwo/two_pac_0d0.png" alt="Pacific Tropical Outlook" className="w-full h-[260px] object-contain bg-slate-900" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <div className="p-2 text-[10px] text-slate-400">East Pacific outlook</div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
          <div className="p-2 bg-slate-800 text-xs text-white font-medium">Western Pacific &bull; Typhoons near Thailand</div>
          <div className="p-3">
            {loading && (
              <div className="flex items-center justify-center py-10 text-slate-400">
                <Loader2 size={20} className="animate-spin mr-2" />
                <span className="text-sm">Fetching live storm data from NHC...</span>
              </div>
            )}

            {error && !loading && (
              <div className="flex items-center gap-2 text-amber-300 text-sm py-6 px-2">
                <Info size={16} />
                <span>Storm data temporarily unavailable. NHC outlook images above still work.</span>
              </div>
            )}

            {!loading && !error && storms.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 size={32} className="text-green-400 mb-2" />
                <p className="text-sm font-medium text-slate-200">No active tropical cyclones right now</p>
                <p className="text-xs text-slate-500 mt-1">NHC reports no active storms in any basin.</p>
              </div>
            )}

            {!loading && !error && nearbyStorms.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] text-amber-300 font-medium flex items-center gap-1"><AlertTriangle size={12} /> Near {location?.name ?? 'Ratchaburi'} (within 3000km)</div>
                {nearbyStorms.map((s) => (
                  <StormCard key={s.id} storm={s} />
                ))}
              </div>
            )}

            {!loading && !error && otherStorms.length > 0 && (
              <div className="space-y-2 mt-3">
                {nearbyStorms.length > 0 && <div className="text-[11px] text-slate-400 font-medium pt-2 border-t border-slate-700/50">Other active storms</div>}
                {otherStorms.map((s) => (
                  <StormCard key={s.id} storm={s} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-slate-400 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live data from NHC ATCF &bull; storm details update every 6h
          </span>
          <a
            href={`https://www.windy.com/?hurricaneTracker,${lat},${lon},5`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-full bg-sky-600 text-white text-xs flex items-center gap-1 hover:bg-sky-500"
          >
            Open Full Map <ExternalLink size={10} />
          </a>
        </div>
      </div>
    </div>
  );
}

function StormCard({ storm }: { storm: TropicalStorm & { distanceKm: number } }) {
  const categoryColor = storm.category !== '—' && storm.category !== ''
    ? 'text-red-300 bg-red-500/15 border-red-500/40'
    : 'text-sky-300 bg-sky-500/15 border-sky-500/40';

  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-600">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${categoryColor}`}>
          <Wind size={18} />
        </div>
        <div>
          <div className="text-sm text-white font-medium">
            {storm.name} {storm.category !== '—' && storm.category !== '' && `(${storm.category})`}
          </div>
          <div className="text-xs text-slate-400">
            {storm.type} &bull; {storm.basin} &bull; {Math.round(storm.distanceKm).toLocaleString()}km away
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-bold text-white">{storm.intensityMph} mph</div>
        <div className="text-xs text-slate-400">
          {storm.pressureMb > 0 ? `${storm.pressureMb} mb` : '—'} &bull; {storm.movement || '—'}
        </div>
      </div>
    </div>
  );
}

interface LightningStrike {
  lat: number;
  lon: number;
  t: number;
}

interface RegionBounds {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
  label: string;
}

const REGIONS: { id: LightningRegion; bounds: RegionBounds }[] = [
  { id: 'nearby', bounds: { latMin: 1, latMax: 26, lonMin: 88, lonMax: 113, label: 'Nearby' } },
  { id: 'asia', bounds: { latMin: -15, latMax: 65, lonMin: 45, lonMax: 185, label: 'Asia-Pacific' } },
  { id: 'europe', bounds: { latMin: 25, latMax: 75, lonMin: -30, lonMax: 50, label: 'Europe/Africa' } },
  { id: 'americas', bounds: { latMin: -60, latMax: 75, lonMin: -175, lonMax: -25, label: 'Americas' } },
  { id: 'global', bounds: { latMin: -60, latMax: 80, lonMin: -180, lonMax: 180, label: 'Global' } },
];

function getRegionBounds(r: LightningRegion, locLat: number, locLon: number): RegionBounds {
  if (r === 'nearby') {
    return {
      latMin: locLat - 12, latMax: locLat + 12,
      lonMin: locLon - 12, lonMax: locLon + 12,
      label: 'Nearby',
    };
  }
  return REGIONS.find(reg => reg.id === r)?.bounds ?? REGIONS[4].bounds;
}

const CANVAS_SIZE = 900;

function LightningTracker({ location }: { location: GeoLocation | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState('Connecting to lightning detection network...');
  const [connected, setConnected] = useState(false);
  const [region, setRegion] = useState<LightningRegion>('asia');
  const [error, setError] = useState<string | null>(null);
  const [retryIn, setRetryIn] = useState(0);

  const strikesRef = useRef<LightningStrike[]>([]);
  const locationRef = useRef({ lat: location?.latitude ?? 13.9642, lon: location?.longitude ?? 99.9445 });
  const regionRef = useRef<LightningRegion>('asia');
  const connectedRef = useRef(false);
  const rafRef = useRef(0);

  useEffect(() => {
    locationRef.current = { lat: location?.latitude ?? 13.9642, lon: location?.longitude ?? 99.9445 };
  }, [location]);

  useEffect(() => { regionRef.current = region; }, [region]);

  // Polling effect — always uses the server proxy
  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    let retryTimer: ReturnType<typeof setInterval> | null = null;
    let attempt = 0;

    const poll = async () => {
      if (!mounted) return;
      const bounds = getRegionBounds(regionRef.current, locationRef.current.lat, locationRef.current.lon);

      try {
        const params = new URLSearchParams({
          latMin: String(bounds.latMin),
          latMax: String(bounds.latMax),
          lonMin: String(bounds.lonMin),
          lonMax: String(bounds.lonMax),
        });
        const response = await fetch(`${supabaseUrl}/functions/v1/lightning-proxy?${params}`);
        if (!response.ok) throw new Error(`Proxy error: ${response.status}`);
        const payload: {
          strikes?: { lat: number; lon: number; time?: number }[];
          connected?: boolean;
          error?: string;
        } = await response.json();
        if (!mounted) return;

        attempt = 0;
        setRetryIn(0);
        if (retryTimer) { clearInterval(retryTimer); retryTimer = null; }

        if (payload.connected) {
          if (!connectedRef.current) {
            connectedRef.current = true;
            setConnected(true);
          }
          setError(null);
          setStatus(`LIVE - ${payload.strikes?.length ?? 0} strikes detected this cycle`);
        } else {
          if (connectedRef.current) {
            connectedRef.current = false;
            setConnected(false);
          }
          setStatus('Connected to server, waiting for lightning activity...');
          if (payload.error) {
            setError(`Server: ${payload.error}`);
          }
        }

        const newStrikes = (payload.strikes ?? []).map((s) => ({
          lat: s.lat,
          lon: s.lon,
          t: typeof s.time === 'number'
            ? (s.time > 10_000_000_000 ? Math.floor(s.time / 1_000_000) : s.time)
            : Date.now(),
        }));

        if (newStrikes.length > 0) {
          const existing = new Set(strikesRef.current.map(s => `${s.lat.toFixed(3)},${s.lon.toFixed(3)},${s.t}`));
          const fresh = newStrikes.filter(s => !existing.has(`${s.lat.toFixed(3)},${s.lon.toFixed(3)},${s.t}`));
          if (fresh.length > 0) {
            strikesRef.current = [...strikesRef.current, ...fresh].slice(-600);
            setCount(strikesRef.current.length);
          }
        }
      } catch {
        if (!mounted) return;
        attempt++;
        connectedRef.current = false;
        setConnected(false);

        if (attempt <= 3) {
          setStatus(`Connection failed, retrying (attempt ${attempt})...`);
        } else {
          setStatus('Lightning service unavailable');
          setError('Cannot reach the lightning detection server. The Blitzortung network may be temporarily unreachable. Retries will continue automatically.');
        }

        if (!retryTimer) {
          let countdown = 15;
          setRetryIn(countdown);
          retryTimer = setInterval(() => {
            if (!mounted) return;
            countdown--;
            setRetryIn(countdown);
            if (countdown <= 0) {
              if (retryTimer) { clearInterval(retryTimer); retryTimer = null; }
            }
          }, 1000);
        }
      }
    };

    setStatus('Connecting to lightning detection network...');
    setError(null);
    void poll();
    timer = setInterval(() => void poll(), 15000);

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
      if (retryTimer) clearInterval(retryTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Canvas rendering effect
  useEffect(() => {
    let frame = 0;

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) { rafRef.current = requestAnimationFrame(draw); return; }
      const ctx = canvas.getContext('2d');
      if (!ctx) { rafRef.current = requestAnimationFrame(draw); return; }

      frame++;
      const SIZE = CANVAS_SIZE;
      const bounds = getRegionBounds(regionRef.current, locationRef.current.lat, locationRef.current.lon);
      const latRange = bounds.latMax - bounds.latMin;
      const lonRange = bounds.lonMax - bounds.lonMin;

      const projectX = (lon: number) => ((lon - bounds.lonMin) / lonRange) * SIZE;
      const projectY = (lat: number) => ((bounds.latMax - lat) / latRange) * SIZE;

      // Background — deep ocean blue, NOT black
      const bgGrad = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE * 0.7);
      bgGrad.addColorStop(0, '#122845');
      bgGrad.addColorStop(1, '#0a1a2e');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, SIZE, SIZE);

      // Continent outlines (simplified rectangles approximating land masses)
      const continents: number[][] = [
        // North America
        [-168, 70, -50, 25],
        // South America
        [-82, 12, -35, -55],
        // Europe
        [-10, 70, 40, 36],
        // Africa
        [-18, 36, 52, -35],
        // Asia
        [40, 75, 145, 5],
        // Southeast Asia / Indonesia
        [95, 8, 142, -11],
        // Australia
        [113, -11, 154, -39],
        // Greenland
        [-55, 83, -20, 60],
        // Japan
        [130, 45, 146, 31],
        // UK
        [-8, 59, 2, 50],
        // Madagascar
        [43, -12, 51, -26],
        // New Zealand
        [166, -34, 179, -47],
      ];

      ctx.fillStyle = 'rgba(30,55,90,0.55)';
      ctx.strokeStyle = 'rgba(56,89,138,0.5)';
      ctx.lineWidth = 1;
      for (const [cLonMin, cLatMax, cLonMax, cLatMin] of continents) {
        const x1 = projectX(cLonMin);
        const y1 = projectY(cLatMax);
        const x2 = projectX(cLonMax);
        const y2 = projectY(cLatMin);
        if (x2 < 0 || x1 > SIZE || y2 < 0 || y1 > SIZE) continue;
        ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      }

      // Latitude/longitude grid
      ctx.strokeStyle = 'rgba(56,89,138,0.25)';
      ctx.lineWidth = 0.6;
      const gridStep = latRange > 100 ? 30 : latRange > 50 ? 15 : latRange > 20 ? 10 : 5;
      for (let lat = Math.ceil(bounds.latMin / gridStep) * gridStep; lat <= bounds.latMax; lat += gridStep) {
        const y = projectY(lat);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(SIZE, y); ctx.stroke();
        ctx.fillStyle = 'rgba(100,130,170,0.5)';
        ctx.font = '10px sans-serif';
        ctx.fillText(`${lat}°`, 4, y - 2);
      }
      for (let lon = Math.ceil(bounds.lonMin / gridStep) * gridStep; lon <= bounds.lonMax; lon += gridStep) {
        const x = projectX(lon);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, SIZE); ctx.stroke();
        ctx.fillStyle = 'rgba(100,130,170,0.5)';
        ctx.font = '10px sans-serif';
        ctx.fillText(`${lon}°`, x + 2, SIZE - 4);
      }

      // Equator highlight
      if (bounds.latMin <= 0 && bounds.latMax >= 0) {
        const y = projectY(0);
        ctx.strokeStyle = 'rgba(56,189,248,0.25)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(SIZE, y); ctx.stroke();
        ctx.setLineDash([]);
      }

      // Location marker with pulsing ring
      const loc = locationRef.current;
      if (loc.lat >= bounds.latMin && loc.lat <= bounds.latMax && loc.lon >= bounds.lonMin && loc.lon <= bounds.lonMax) {
        const lx = projectX(loc.lon);
        const ly = projectY(loc.lat);
        const pulse = (frame % 80) / 80;
        ctx.beginPath();
        ctx.arc(lx, ly, 8 + pulse * 18, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(56,189,248,${0.6 * (1 - pulse)})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(lx, ly, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fill();
        ctx.strokeStyle = '#0c4a6e';
        ctx.lineWidth = 2;
        ctx.stroke();

        const label = location?.name ?? 'Ratchaburi';
        ctx.font = 'bold 12px sans-serif';
        const labelW = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(10,26,46,0.85)';
        ctx.fillRect(lx + 10, ly - 18, labelW + 10, 16);
        ctx.fillStyle = '#7dd3fc';
        ctx.fillText(label, lx + 15, ly - 6);
      }

      // Draw strikes
      const now = Date.now();
      const STRIKE_TTL = 180_000; // 3 minutes
      strikesRef.current = strikesRef.current.filter(s => now - s.t < STRIKE_TTL);

      for (const s of strikesRef.current) {
        const x = projectX(s.lon);
        const y = projectY(s.lat);
        if (x < -20 || x > SIZE + 20 || y < -20 || y > SIZE + 20) continue;

        const age = (now - s.t) / STRIKE_TTL;
        const alpha = 1 - age;

        // Outer glow
        const glowR = 14 + age * 24;
        const glowGrad = ctx.createRadialGradient(x, y, 0, x, y, glowR);
        glowGrad.addColorStop(0, `rgba(251,191,36,${alpha * 0.5})`);
        glowGrad.addColorStop(0.5, `rgba(251,191,36,${alpha * 0.15})`);
        glowGrad.addColorStop(1, 'rgba(251,191,36,0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(x, y, glowR, 0, Math.PI * 2);
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(253,224,71,${alpha})`;
        ctx.fill();

        // White flash for new strikes (first 6 seconds)
        if (age < 0.05) {
          const flashAlpha = 1 - age / 0.05;
          // Big flash circle
          ctx.beginPath();
          ctx.arc(x, y, 26, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${0.5 * flashAlpha})`;
          ctx.fill();

          // Lightning bolt icon
          ctx.strokeStyle = `rgba(255,255,255,${flashAlpha})`;
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(x, y - 16);
          ctx.lineTo(x - 4, y - 4);
          ctx.lineTo(x + 4, y - 4);
          ctx.lineTo(x, y + 16);
          ctx.stroke();
          ctx.lineCap = 'butt';
        }
      }

      // Scan line effect
      const scanY = (frame * 1.2) % SIZE;
      const scanGrad = ctx.createLinearGradient(0, scanY - 50, 0, scanY + 50);
      scanGrad.addColorStop(0, 'rgba(56,189,248,0)');
      scanGrad.addColorStop(0.5, 'rgba(56,189,248,0.08)');
      scanGrad.addColorStop(1, 'rgba(56,189,248,0)');
      ctx.fillStyle = scanGrad;
      ctx.fillRect(0, scanY - 50, SIZE, 100);

      // Status panel (top-left)
      ctx.fillStyle = 'rgba(10,26,46,0.9)';
      ctx.strokeStyle = connected ? 'rgba(74,222,128,0.4)' : 'rgba(251,191,36,0.4)';
      ctx.lineWidth = 1;
      ctx.fillRect(10, 10, 200, 32);
      ctx.strokeRect(10, 10, 200, 32);

      // Status indicator dot
      ctx.fillStyle = connected ? '#4ade80' : '#fbbf24';
      ctx.beginPath();
      ctx.arc(24, 26, 4, 0, Math.PI * 2);
      ctx.fill();
      if (connected) {
        const pulseR = 4 + ((frame % 50) / 50) * 8;
        ctx.strokeStyle = `rgba(74,222,128,${0.5 * (1 - (frame % 50) / 50)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(24, 26, pulseR, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = connected ? '#86efac' : '#fcd34d';
      ctx.font = 'bold 11px sans-serif';
      const statusText = connected ? 'LIVE - Connected' : (retryIn > 0 ? `Retry in ${retryIn}s` : 'Connecting...');
      ctx.fillText(statusText, 34, 30);

      // Strike counter (top-right)
      const countLabel = `${strikesRef.current.length} strikes (3 min)`;
      ctx.font = 'bold 11px sans-serif';
      const cW = ctx.measureText(countLabel).width;
      ctx.fillStyle = 'rgba(10,26,46,0.9)';
      ctx.strokeStyle = 'rgba(253,224,71,0.4)';
      ctx.lineWidth = 1;
      ctx.fillRect(SIZE - cW - 24, 10, cW + 14, 32);
      ctx.strokeRect(SIZE - cW - 24, 10, cW + 14, 32);
      ctx.fillStyle = '#fde047';
      ctx.fillText(countLabel, SIZE - cW - 17, 30);

      // Region label (bottom-right)
      ctx.fillStyle = 'rgba(10,26,46,0.85)';
      ctx.font = 'bold 10px sans-serif';
      const regionLabel = getRegionBounds(regionRef.current, locationRef.current.lat, locationRef.current.lon).label;
      const rW = ctx.measureText(regionLabel).width;
      ctx.fillRect(SIZE - rW - 22, SIZE - 28, rW + 14, 20);
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(regionLabel, SIZE - rW - 15, SIZE - 13);

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [region, retryIn]);

  return (
    <div className="space-y-3">
      {/* Status bar */}
      <div className="flex items-center gap-3 flex-wrap bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/50">
        <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${connected ? 'bg-green-500' : 'bg-amber-400'}`} />
        <span className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
          {!connected && <Loader2 size={12} className="animate-spin" />}
          {status}
        </span>
        <span className="text-xs text-amber-300 font-bold flex items-center gap-1">
          <Zap size={12} /> {count} strikes
        </span>
        <span className="ml-auto text-[10px] text-slate-500">Blitzortung.org via server proxy &bull; polls every 15s</span>
      </div>

      {/* Error message */}
      {error && !connected && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2">
          <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-amber-200 font-medium">{error}</p>
            <p className="text-[11px] text-slate-400 mt-1">The map will update automatically once the connection is restored. Lightning activity varies by time of day and weather conditions.</p>
          </div>
        </div>
      )}

      {/* Region selector */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setRegion('nearby')} className={region === 'nearby' ? 'px-3 py-1.5 rounded-full text-xs bg-sky-500 text-white border border-sky-400 shadow' : 'px-3 py-1.5 rounded-full text-xs bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600'}>Near {location?.name ?? 'Ratchaburi'}</button>
        <button onClick={() => setRegion('asia')} className={region === 'asia' ? 'px-3 py-1.5 rounded-full text-xs bg-sky-500 text-white border border-sky-400 shadow' : 'px-3 py-1.5 rounded-full text-xs bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600'}>Asia-Pacific</button>
        <button onClick={() => setRegion('europe')} className={region === 'europe' ? 'px-3 py-1.5 rounded-full text-xs bg-sky-500 text-white border border-sky-400 shadow' : 'px-3 py-1.5 rounded-full text-xs bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600'}>Europe/Africa</button>
        <button onClick={() => setRegion('americas')} className={region === 'americas' ? 'px-3 py-1.5 rounded-full text-xs bg-sky-500 text-white border border-sky-400 shadow' : 'px-3 py-1.5 rounded-full text-xs bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600'}>Americas</button>
        <button onClick={() => setRegion('global')} className={region === 'global' ? 'px-3 py-1.5 rounded-full text-xs bg-sky-500 text-white border border-sky-400 shadow' : 'px-3 py-1.5 rounded-full text-xs bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600'}>Global</button>
      </div>

      {/* Map canvas */}
      <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-900 relative">
        <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} className="w-full aspect-square block" />
        <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/70 text-[10px] text-slate-300 border border-slate-700/50 pointer-events-none">
          Blue dot = your location &bull; Yellow = recent strike &bull; White flash = new strike &bull; Strikes fade over 3 min
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-slate-400 flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full animate-pulse ${connected ? 'bg-green-500' : 'bg-amber-500'}`} />
          Live lightning from Blitzortung.org community sensors worldwide
        </span>
        <a href="https://www.lightningmaps.org/" target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-full bg-sky-600 text-white text-xs flex items-center gap-1 hover:bg-sky-500">
          Open Lightning Maps <ExternalLink size={10} />
        </a>
      </div>
    </div>
  );
}

export function LiveTrackersModal({ open, onClose, location, hourly }: { open: boolean; onClose: () => void; location: GeoLocation | null; hourly: HourlyForecast | null }) {
  const [tab, setTab] = useState<TabId>('precip');
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-6xl rounded-2xl bg-slate-800 border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-700">
          <h2 className="text-white font-bold flex items-center gap-2 text-sm"><AlertTriangle size={18} className="text-amber-400" /> Live Trackers • {location?.name ?? 'Ratchaburi'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white"><X size={18} /></button>
        </div>
        <div className="flex gap-2 px-3 sm:px-6 py-3 bg-slate-900/60 overflow-x-auto">
          <button onClick={() => setTab('precip')} className={tab === 'precip' ? 'px-3 py-1.5 rounded-full text-xs bg-sky-500 text-white border border-sky-400 shadow' : 'px-3 py-1.5 rounded-full text-xs bg-slate-700 text-slate-300 border border-slate-600'}>Precipitation</button>
          <button onClick={() => setTab('warnings')} className={tab === 'warnings' ? 'px-3 py-1.5 rounded-full text-xs bg-amber-500 text-white border border-amber-400 shadow' : 'px-3 py-1.5 rounded-full text-xs bg-slate-700 text-slate-300 border border-slate-600'}>⚠️ Severe Warnings</button>
          <button onClick={() => setTab('satellite')} className={tab === 'satellite' ? 'px-3 py-1.5 rounded-full text-xs bg-sky-500 text-white border border-sky-400 shadow' : 'px-3 py-1.5 rounded-full text-xs bg-slate-700 text-slate-300 border border-slate-600'}>Satellite</button>
          <button onClick={() => setTab('earthquake')} className={tab === 'earthquake' ? 'px-3 py-1.5 rounded-full text-xs bg-sky-500 text-white border border-sky-400 shadow' : 'px-3 py-1.5 rounded-full text-xs bg-slate-700 text-slate-300 border border-slate-600'}>Earthquake</button>
          <button onClick={() => setTab('hurricane')} className={tab === 'hurricane' ? 'px-3 py-1.5 rounded-full text-xs bg-sky-500 text-white border border-sky-400 shadow' : 'px-3 py-1.5 rounded-full text-xs bg-slate-700 text-slate-300 border border-slate-600'}>Hurricanes</button>
          <button onClick={() => setTab('lightning')} className={tab === 'lightning' ? 'px-3 py-1.5 rounded-full text-xs bg-sky-500 text-white border border-sky-400 shadow' : 'px-3 py-1.5 rounded-full text-xs bg-slate-700 text-slate-300 border border-slate-600'}>Lightning</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-900/20">
          {tab === 'precip' && <PrecipitationTracker location={location} />}
          {tab === 'warnings' && <WarningsTracker location={location} />}
          {tab === 'satellite' && <SatelliteTracker />}
          {tab === 'earthquake' && <EarthquakeTracker location={location} />}
          {tab === 'hurricane' && <HurricaneTracker location={location} />}
          {tab === 'lightning' && <LightningTracker location={location} />}
        </div>
      </div>
    </div>
  );
}