// @ts-nocheck -- WeatherLogs with IndexedDB photo storage + Multi-Entry observations
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/modelcast/lib/supabase';
import type { GeoLocation, CurrentWeather } from '@/modelcast/lib/types';
import ObservationImagePicker from '@/modelcast/components/ObservationImagePicker';

type WeatherChange = { time: string; condition: string; severity: string; photo?: string; photoId?: string };

const CONDITIONS = [
  { id: 'sunny', label: 'Sunny (0-10%)', emoji: '☀️', severity: 1, group: 'Clear', level: 'light' },
  { id: 'partly_cloudy', label: 'Partly Cloudy (25-50%)', emoji: '⛅', severity: 2, group: 'Clear', level: 'light' },
  { id: 'mostly_cloudy', label: 'Mostly Cloudy (60-90%)', emoji: '🌥️', severity: 3, group: 'Clear', level: 'light' },
  { id: 'overcast', label: 'Overcast (100%)', emoji: '☁️', severity: 4, group: 'Clear', level: 'light' },
  { id: 'humid', label: 'Humid', emoji: '💧', severity: 5, group: 'Visibility', level: 'light' },
  { id: 'drizzle', label: 'Drizzle (misty)', emoji: '🌦️', severity: 6, group: 'Light Rain', level: 'light' },
  { id: 'light_rain', label: 'Light Rain', emoji: '🌧️', severity: 7, group: 'Light Rain', level: 'light' },
  { id: 'foggy', label: 'Foggy / Mist', emoji: '🌁', severity: 8, group: 'Visibility', level: 'moderate' },
  { id: 'hazy', label: 'Haze / PM2.5', emoji: '🌫️', severity: 9, group: 'Visibility', level: 'moderate' },
  { id: 'windy', label: 'Windy', emoji: '💨', severity: 10, group: 'Temp/Wind', level: 'moderate' },
  { id: 'cold', label: 'Cold', emoji: '🥶', severity: 11, group: 'Temp/Wind', level: 'moderate' },
  { id: 'hot', label: 'Hot', emoji: '🔥', severity: 12, group: 'Temp/Wind', level: 'moderate' },
  { id: 'rainy', label: 'Moderate Rain', emoji: '🌧️', severity: 13, group: 'Light Rain', level: 'moderate' },
  { id: 'flurries', label: 'Flurries', emoji: '🌨️', severity: 14, group: 'Snow', level: 'moderate' },
  { id: 'heavy_rain', label: 'Heavy Rain', emoji: '🌊', severity: 15, group: 'Heavy Precip', level: 'heavy' },
  { id: 'snow', label: 'Snow (1-5cm)', emoji: '❄️', severity: 16, group: 'Snow', level: 'heavy' },
  { id: 'sleet', label: 'Sleet', emoji: '🌨️', severity: 17, group: 'Heavy Precip', level: 'heavy' },
  { id: 'freezing_rain', label: 'Freezing Rain', emoji: '🌧️❄️', severity: 18, group: 'Heavy Precip', level: 'heavy' },
  { id: 'hail', label: 'Hail', emoji: '🧊', severity: 19, group: 'Heavy Precip', level: 'heavy' },
  { id: 'icy', label: 'Icy Road', emoji: '🧊', severity: 20, group: 'Temp/Wind', level: 'heavy' },
  { id: 'heavy_snow', label: 'Heavy Snow (5-15cm)', emoji: '❄️❄️', severity: 21, group: 'Snow', level: 'heavy' },
  { id: 'blowing_snow', label: 'Blowing Snow', emoji: '💨❄️', severity: 22, group: 'Snow', level: 'heavy' },
  { id: 'snow_squall', label: 'Snow Squall', emoji: '🌬️❄️', severity: 23, group: 'Snow', level: 'heavy' },
  { id: 'blizzard', label: 'Blizzard', emoji: '❄️💨', severity: 24, group: 'Snow', level: 'extreme' },
  { id: 'thunderstorm', label: 'Thunderstorm', emoji: '⛈️', severity: 25, group: 'Severe', level: 'extreme' },
  { id: 'lightning', label: 'Lightning', emoji: '⚡', severity: 26, group: 'Severe', level: 'extreme' },
  { id: 'sandstorm', label: 'Sandstorm', emoji: '🏜️', severity: 27, group: 'Severe', level: 'extreme' },
  { id: 'tornado', label: 'Tornado', emoji: '🌪️', severity: 28, group: 'Extreme', level: 'extreme' },
  { id: 'hurricane', label: 'Hurricane', emoji: '🌀', severity: 29, group: 'Extreme', level: 'extreme' },
];

const SEVERITY = [
  { id: 'light', label: 'Light', color: '#22c55e', range: '1-7', desc: 'Mild' },
  { id: 'moderate', label: 'Moderate', color: '#eab308', range: '8-14', desc: 'Noticeable' },
  { id: 'heavy', label: 'Heavy', color: '#f97316', range: '15-23', desc: 'Strong' },
  { id: 'extreme', label: 'Extreme', color: '#ef4444', range: '24-29', desc: 'Dangerous' },
];

// --- IndexedDB Native Photo Engine ---
const IDB_NAME = 'modelcast_photos_v1';
const STORE_NAME = 'photos';

function openPhotoDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSavePhoto(id: string, dataUrl: string): Promise<void> {
  const db = await openPhotoDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ id, dataUrl, savedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGetPhoto(id: string): Promise<string | undefined> {
  const db = await openPhotoDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result?.dataUrl);
    req.onerror = () => reject(req.error);
  });
}

async function idbDeletePhotos(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await openPhotoDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    ids.forEach((id) => store.delete(id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbClearPhotos(): Promise<void> {
  const db = await openPhotoDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGetStats(): Promise<{ count: number; kb: number }> {
  try {
    const db = await openPhotoDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      let count = 0;
      let totalBytes = 0;
      req.onsuccess = (e: any) => {
        const cursor = e.target.result;
        if (cursor) {
          count++;
          if (cursor.value?.dataUrl) totalBytes += cursor.value.dataUrl.length;
          cursor.continue();
        } else {
          resolve({ count, kb: Math.round(totalBytes / 1024) });
        }
      };
      req.onerror = () => resolve({ count: 0, kb: 0 });
    });
  } catch {
    return { count: 0, kb: 0 };
  }
}

export function WeatherLogs({ location, current }: { location: GeoLocation; current: CurrentWeather }) {
  const [selected, setSelected] = useState('partly_cloudy');
  const [sev, setSev] = useState('moderate');
  const [note, setNote] = useState('');
  const [mainPhoto, setMainPhoto] = useState<string | undefined>(undefined);
  const [logs, setLogs] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [changes, setChanges] = useState<WeatherChange[]>([
    { time: new Date().toTimeString().slice(0, 5), condition: 'partly_cloudy', severity: 'moderate' },
  ]);
  const [photoCache, setPhotoCache] = useState<Record<string, string>>({});
  const [storageStats, setStorageStats] = useState({ count: 0, kb: 0 });
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [cityOnly, setCityOnly] = useState(true);

  const refreshStats = useCallback(async () => {
    const stats = await idbGetStats();
    setStorageStats(stats);
  }, []);

  // Load logs and photos from IndexedDB
  useEffect(() => {
    try {
      const local = JSON.parse(localStorage.getItem('weather_logs_safe') || '[]');
      setLogs(local.slice(0, 100));

      // Prefetch photos from IndexedDB for displayed logs
      const photoIdsToFetch: string[] = [];
      local.forEach((l: any) => {
        if (l.mainPhotoId) photoIdsToFetch.push(l.mainPhotoId);
        if (l.changes) {
          l.changes.forEach((c: any) => {
            if (c.photoId) photoIdsToFetch.push(c.photoId);
          });
        }
      });

      if (photoIdsToFetch.length > 0) {
        Promise.all(
          photoIdsToFetch.map(async (id) => {
            const dataUrl = await idbGetPhoto(id);
            return { id, dataUrl };
          })
        ).then((results) => {
          const cache: Record<string, string> = {};
          results.forEach((r) => {
            if (r.dataUrl) cache[r.id] = r.dataUrl;
          });
          setPhotoCache((prev) => ({ ...prev, ...cache }));
        });
      }
    } catch {}
    refreshStats();
  }, [refreshStats]);

  useEffect(() => {
    const cond = CONDITIONS.find((c) => c.id === selected);
    if (cond) setSev(cond.level);
  }, [selected]);

  const handleAdd = async () => {
    setMsg('Saving log & optimizing photo storage...');
    const mainCond = CONDITIONS.find((c) => c.id === selected);
    const nowStamp = Date.now();
    const newCacheEntries: Record<string, string> = {};

    // 1. Offload main photo to IndexedDB
    let mainPhotoId: string | undefined = undefined;
    if (mainPhoto) {
      mainPhotoId = `p_main_${nowStamp}`;
      await idbSavePhoto(mainPhotoId, mainPhoto);
      newCacheEntries[mainPhotoId] = mainPhoto;
    }

    // 2. Offload timeline change photos to IndexedDB
    const processedChanges = await Promise.all(
      changes.map(async (c, idx) => {
        if (c.photo) {
          const chPhotoId = `p_ch_${nowStamp}_${idx}`;
          await idbSavePhoto(chPhotoId, c.photo);
          newCacheEntries[chPhotoId] = c.photo;
          return { ...c, photoId: chPhotoId, photo: undefined }; // keep localStorage lightweight
        }
        return c;
      })
    );

    setPhotoCache((prev) => ({ ...prev, ...newCacheEntries }));

    const timeline = processedChanges
      .map((c) => {
        const cond = CONDITIONS.find((x) => x.id === c.condition);
        return `${c.time} ${cond?.emoji} ${cond?.label}[${c.severity}]`;
      })
      .join(' → ');

    const entry = {
      id: 'local_' + nowStamp,
      condition: selected,
      severity: sev,
      note,
      mainPhotoId,
      timeline,
      changes: processedChanges,
      changeCount: processedChanges.length,
      location_name: location.name,
      temperature: current.temperature,
      logged_at: new Date().toISOString(),
      sevNum: mainCond?.severity,
      group: mainCond?.group,
    };

    try {
      const existing = JSON.parse(localStorage.getItem('weather_logs_safe') || '[]');
      existing.unshift(entry);
      localStorage.setItem('weather_logs_safe', JSON.stringify(existing.slice(0, 150)));

      try {
        await supabase.from('weather_logs').insert({
          note: `[${selected}|${sev}|${changes.length} changes Sev${mainCond?.severity}/29] ${timeline} | ${note}`,
          location_name: location.name,
          logged_at: new Date().toISOString(),
        } as any);
      } catch {}

      try {
        const acc = JSON.parse(localStorage.getItem('model_accuracy_auto_v1') || '{}');
        changes.forEach((ch) => {
          const c = CONDITIONS.find((x) => x.id === ch.condition);
          ['ecmwf', 'gfs', 'icon', 'ukmo', 'gem'].forEach((k) => {
            if (!acc[k]) acc[k] = { score: 0, count: 0 };
            acc[k].score += (c?.severity || 5) / 10;
            acc[k].count += 1;
          });
        });
        localStorage.setItem('model_accuracy_auto_v1', JSON.stringify(acc));
      } catch {}
    } catch (e) {
      console.error(e);
    }

    setLogs((prev) => [entry, ...prev].slice(0, 100));
    setMsg('✅ Saved ' + changes.length + ' observations • Photos safely stored in IndexedDB');
    setNote('');
    setMainPhoto(undefined);
    setChanges([{ time: new Date().toTimeString().slice(0, 5), condition: 'partly_cloudy', severity: 'moderate' }]);
    refreshStats();
  };

  const handleDeleteOne = async (id: string) => {
    if (!confirm('Delete this log?')) return;
    try {
      const existing = JSON.parse(localStorage.getItem('weather_logs_safe') || '[]');
      const target = existing.find((l: any) => l.id === id);

      // Clean up associated photos from IndexedDB
      if (target) {
        const photosToDelete: string[] = [];
        if (target.mainPhotoId) photosToDelete.push(target.mainPhotoId);
        if (target.changes) {
          target.changes.forEach((c: any) => {
            if (c.photoId) photosToDelete.push(c.photoId);
          });
        }
        await idbDeletePhotos(photosToDelete);
      }

      const filtered = existing.filter((l: any) => l.id !== id);
      localStorage.setItem('weather_logs_safe', JSON.stringify(filtered));
      setLogs(filtered.slice(0, 100));
      setMsg('🗑️ Deleted entry and removed photos from storage');
      refreshStats();
    } catch {}
  };

  const handleDeleteAll = async () => {
    if (!confirm('Delete ALL ' + logs.length + ' logs? This cannot be undone!')) return;
    try {
      localStorage.setItem('weather_logs_safe', JSON.stringify([]));
      await idbClearPhotos();
      setLogs([]);
      setPhotoCache({});
      setMsg('🗑️ Cleared all entries and IndexedDB photo cache');
      refreshStats();
    } catch {}
  };

  const bySev = useMemo(() => {
    const c: any = { light: 0, moderate: 0, heavy: 0, extreme: 0 };
    logs.forEach((l: any) => {
      if (l.severity) c[l.severity] = (c[l.severity] || 0) + 1;
      if (l.changes) l.changes.forEach((ch: any) => (c[ch.severity] = (c[ch.severity] || 0) + 1));
    });
    return c;
  }, [logs]);

  const cityLogs = useMemo(
    () => logs.filter((l: any) => (l.location_name ?? '') === location.name),
    [logs, location.name],
  );
  const visibleLogs = cityOnly ? cityLogs : logs;


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Lightbox Modal */}
      {lightboxImg && (
        <div
          onClick={() => setLightboxImg(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <img
            src={lightboxImg}
            alt="Full Observation"
            style={{ maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: '12px', border: '2px solid #38bdf8' }}
          />
          <button
            onClick={() => setLightboxImg(null)}
            style={{
              marginTop: '14px',
              padding: '8px 20px',
              background: '#0284c7',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            ✕ Close View
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <div style={{ padding: '12px', background: '#0f172a', borderRadius: '12px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#64748b', fontSize: '10px' }}>TOTAL LOGS</div>
            <div style={{ color: 'white', fontWeight: 'bold', fontSize: '20px' }}>{logs.length}</div>
          </div>
          <div style={{ padding: '4px 10px', borderRadius: '8px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)' }}>
            <div style={{ color: '#38bdf8', fontSize: '9px', fontWeight: 'bold' }}>PHOTO STORAGE</div>
            <div style={{ color: 'white', fontWeight: 'bold', fontSize: '12px' }}>
              💾 {storageStats.count} photos ({storageStats.kb} KB)
            </div>
          </div>
          {SEVERITY.map((s) => (
            <div key={s.id} style={{ padding: '4px 8px', borderRadius: '8px', background: s.color + '15', border: '1px solid ' + s.color + '30' }}>
              <div style={{ color: s.color, fontSize: '9px', fontWeight: 'bold' }}>
                {s.label.toUpperCase()} {s.range}
              </div>
              <div style={{ color: 'white', fontWeight: 'bold' }}>{bySev[s.id] || 0}</div>
            </div>
          ))}
        </div>
        <button
          onClick={handleDeleteAll}
          disabled={logs.length === 0}
          style={{
            padding: '10px 16px',
            borderRadius: '10px',
            background: logs.length === 0 ? '#334155' : '#7f1d1d',
            color: 'white',
            fontWeight: 'bold',
            border: '1px solid #ef4444',
            cursor: logs.length === 0 ? 'not-allowed' : 'pointer',
            opacity: logs.length === 0 ? 0.5 : 1,
          }}
        >
          🗑️ Delete All ({logs.length})
        </button>
      </div>

      {/* Main Submission Form */}
      <div style={{ padding: '16px', background: '#1e293b', borderRadius: '16px', border: '1px solid #334155' }}>
        <h2 style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>
          Severity Logs • 29 Types + IndexedDB Photo Storage • {location.name} • {current.temperature}°
        </h2>
        <p style={{ color: '#4ade80', fontSize: '11px', marginTop: '2px' }}>
          ✅ High-capacity storage • Main day photo + Timeline observation photos • Tap thumbnails to enlarge
        </p>

        {/* Severity Selector */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          {SEVERITY.map((s) => {
            const active = sev === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSev(s.id)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '10px',
                  border: active ? '2px solid ' + s.color : '1px solid #475569',
                  background: active ? s.color + '25' : '#0f172a',
                  color: active ? s.color : '#94a3b8',
                  fontWeight: active ? 'bold' : 'normal',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '12px' }}>{s.label.toUpperCase()}</div>
                <div style={{ fontSize: '9px' }}>{s.range}</div>
              </button>
            );
          })}
        </div>

        {/* Condition Grid */}
        {SEVERITY.map((level) => {
          const levelConds = CONDITIONS.filter((c) => c.level === level.id).sort((a, b) => a.severity - b.severity);
          return (
            <div key={level.id} style={{ marginTop: '12px', padding: '10px', borderRadius: '12px', background: level.color + '10', border: '1px solid ' + level.color + '30' }}>
              <div style={{ color: level.color, fontSize: '11px', fontWeight: 'bold' }}>
                {level.label.toUpperCase()} • Sev {level.range} • {levelConds.length} types • {level.desc}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '6px', marginTop: '8px' }}>
                {levelConds.map((c) => {
                  const active = selected === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelected(c.id)}
                      style={{
                        padding: '8px',
                        borderRadius: '10px',
                        border: active ? '2px solid #38bdf8' : '1px solid #475569',
                        background: active ? 'rgba(56,189,248,0.25)' : '#0f172a',
                        color: 'white',
                        cursor: 'pointer',
                        position: 'relative',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ position: 'absolute', top: '4px', right: '6px', fontSize: '9px', color: '#64748b', fontWeight: 'bold' }}>{c.severity}</div>
                      <div style={{ fontSize: '18px' }}>{c.emoji}</div>
                      <div style={{ fontSize: '10px', fontWeight: 'bold' }}>{c.label}</div>
                      <div style={{ fontSize: '8px', color: '#64748b' }}>{c.group}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Multi-entry observation container */}
        <div style={{ marginTop: '16px', padding: '12px', background: '#0f172a', borderRadius: '12px', border: '2px solid #22c55e' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#22c55e', fontSize: '13px', fontWeight: 'bold' }}>
              📝 Timeline Observations ({changes.length} in this log)
            </span>
            <button
              onClick={() => setChanges([...changes, { time: new Date().toTimeString().slice(0, 5), condition: selected, severity: sev }])}
              style={{ padding: '8px 14px', borderRadius: '8px', background: '#22c55e', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
            >
              + Add Observation
            </button>
          </div>
          <p style={{ color: '#64748b', fontSize: '10px', marginTop: '4px' }}>
            Capture timeline changes (e.g. 09:00 Sunny 📷 → 14:00 Heavy Rain 📷) with photo verification
          </p>

          {changes.map((ch, idx) => {
            const cond = CONDITIONS.find((c) => c.id === ch.condition);
            const sevColor = SEVERITY.find((s) => s.id === ch.severity)?.color || '#64748b';
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  gap: '6px',
                  marginTop: '10px',
                  padding: '10px',
                  background: '#1e293b',
                  borderRadius: '10px',
                  border: '1px solid #334155',
                  borderLeft: '5px solid ' + sevColor,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ color: sevColor, fontWeight: 'bold', fontSize: '12px' }}>{idx + 1}.</span>
                <input
                  type="time"
                  value={ch.time}
                  onChange={(e) => {
                    const c = [...changes];
                    c[idx].time = e.target.value;
                    setChanges(c);
                  }}
                  style={{ padding: '6px', borderRadius: '6px', background: '#0f172a', border: '1px solid #475569', color: 'white', fontSize: '12px' }}
                />
                <select
                  value={ch.condition}
                  onChange={(e) => {
                    const c = [...changes];
                    c[idx].condition = e.target.value;
                    const newCond = CONDITIONS.find((x) => x.id === e.target.value);
                    if (newCond) c[idx].severity = newCond.level;
                    setChanges([...c]);
                  }}
                  style={{ padding: '6px', borderRadius: '6px', background: '#0f172a', color: 'white', border: '1px solid #475569', fontSize: '11px', minWidth: '150px' }}
                >
                  {CONDITIONS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.severity}. {c.emoji} {c.label}
                    </option>
                  ))}
                </select>
                <select
                  value={ch.severity}
                  onChange={(e) => {
                    const c = [...changes];
                    c[idx].severity = e.target.value;
                    setChanges([...c]);
                  }}
                  style={{ padding: '6px', borderRadius: '6px', background: sevColor + '25', color: sevColor, border: '2px solid ' + sevColor, fontSize: '11px', fontWeight: 'bold' }}
                >
                  {SEVERITY.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label.toUpperCase()}
                    </option>
                  ))}
                </select>
                <span style={{ color: '#64748b', fontSize: '10px' }}>Sev {cond?.severity}/29</span>

                {/* Timeline Photo Picker */}
                <ObservationImagePicker
                  value={ch.photo}
                  onChange={(url) => {
                    const c = [...changes];
                    c[idx].photo = url;
                    setChanges([...c]);
                  }}
                  onPreview={(url) => setLightboxImg(url)}
                />

                <button
                  onClick={() => {
                    if (changes.length > 1) setChanges(changes.filter((_, i) => i !== idx));
                  }}
                  disabled={changes.length === 1}
                  style={{
                    padding: '6px 10px',
                    background: changes.length === 1 ? '#334155' : '#7f1d1d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: changes.length === 1 ? 'not-allowed' : 'pointer',
                    opacity: changes.length === 1 ? 0.5 : 1,
                  }}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>

        {/* Main Photo & Summary Note Bar */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Overall day summary / notes..."
            style={{ flex: 1, minWidth: '220px', padding: '10px', borderRadius: '8px', background: '#0f172a', border: '1px solid #475569', color: 'white' }}
          />

          {/* Main Photo for entire day log */}
          <div style={{ padding: '4px 8px', background: '#0f172a', borderRadius: '8px', border: '1px solid #334155' }}>
            <ObservationImagePicker
              value={mainPhoto}
              onChange={(url) => setMainPhoto(url)}
              label="📷 Main Photo"
              onPreview={(url) => setLightboxImg(url)}
            />
          </div>

          <button
            onClick={handleAdd}
            style={{
              padding: '12px 20px',
              borderRadius: '10px',
              background: SEVERITY.find((s) => s.id === sev)?.color || '#0ea5e9',
              color: 'white',
              fontWeight: 'bold',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            ➕ Save Log ({changes.length} Obs) • {sev.toUpperCase()}
          </button>
        </div>
        <div style={{ color: '#4ade80', fontSize: '12px', marginTop: '8px' }}>{msg}</div>
      </div>

      {/* Saved Logs Feed */}
      <div style={{ padding: '16px', background: '#1e293b', borderRadius: '16px', border: '1px solid #334155' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ color: 'white', fontWeight: 'bold' }}>Logs History ({visibleLogs.length})</h3>
          <button
            onClick={handleDeleteAll}
            disabled={logs.length === 0}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: logs.length === 0 ? '#334155' : '#7f1d1d',
              color: 'white',
              fontWeight: 'bold',
              border: '1px solid #ef4444',
              cursor: logs.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '12px',
            }}
          >
            🗑️ Delete All
          </button>
        </div>

        {/* City filter pills */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
          {[
            { id: true, label: `📍 ${location.name} (${cityLogs.length})` },
            { id: false, label: `🌐 All Cities (${logs.length})` },
          ].map((p) => (
            <button
              key={String(p.id)}
              onClick={() => setCityOnly(p.id)}
              style={{
                padding: '6px 12px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer',
                color: cityOnly === p.id ? 'white' : '#94a3b8',
                background: cityOnly === p.id ? '#0284c7' : '#0f172a',
                border: '1px solid ' + (cityOnly === p.id ? '#38bdf8' : '#334155'),
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {visibleLogs.map((log: any) => {
          const col = SEVERITY.find((s) => s.id === log.severity)?.color || '#475569';
          const mainPhotoSrc = (log.mainPhotoId && photoCache[log.mainPhotoId]) || log.mainPhoto;

          return (
            <div key={log.id} style={{ padding: '12px', background: '#0f172a', borderRadius: '12px', marginTop: '10px', border: '1px solid #334155', borderLeft: '6px solid ' + col }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ background: col, color: 'white', padding: '3px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold' }}>
                  {log.severity?.toUpperCase()} • Sev {log.sevNum}/29 • {log.changeCount || 1} obs
                </span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ color: '#64748b', fontSize: '10px' }}>{new Date(log.logged_at).toLocaleString()}</span>
                  <button onClick={() => handleDeleteOne(log.id)} style={{ padding: '6px 10px', background: '#7f1d1d', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                    🗑️ Delete
                  </button>
                </div>
              </div>

              {/* Main Photo Thumbnail in Log */}
              {mainPhotoSrc && (
                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <img
                    src={mainPhotoSrc}
                    alt="Main Weather Log"
                    onClick={() => setLightboxImg(mainPhotoSrc)}
                    style={{ height: '60px', width: '60px', objectFit: 'cover', borderRadius: '8px', border: '2px solid #38bdf8', cursor: 'pointer' }}
                    title="Click to expand"
                  />
                  <span style={{ color: '#38bdf8', fontSize: '11px' }}>📷 Main Observation Photo (Tap to enlarge)</span>
                </div>
              )}

              <div style={{ color: 'white', fontSize: '13px', marginTop: '8px', fontWeight: 'bold' }}>
                {log.timeline || CONDITIONS.find((c) => c.id === log.condition)?.emoji + ' ' + log.condition}
              </div>

              {/* Timeline Changes & Photos */}
              {log.changes && (
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {log.changes.map((ch: any, i: number) => {
                    const c = CONDITIONS.find((x) => x.id === ch.condition);
                    const col2 = SEVERITY.find((s) => s.id === ch.severity)?.color;
                    const chPhotoSrc = (ch.photoId && photoCache[ch.photoId]) || ch.photo;

                    return (
                      <div key={i} style={{ fontSize: '12px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ color: '#64748b', fontFamily: 'monospace' }}>{ch.time}</span>
                        {chPhotoSrc && (
                          <img
                            src={chPhotoSrc}
                            alt=""
                            onClick={() => setLightboxImg(chPhotoSrc)}
                            style={{ height: '32px', width: '32px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #38bdf8', cursor: 'pointer' }}
                            title="Click to view full photo"
                          />
                        )}
                        <span>
                          {c?.emoji} {c?.label} (Sev {c?.severity}/29)
                        </span>
                        <span style={{ background: col2 + '30', color: col2, padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold', border: '1px solid ' + col2 }}>
                          {ch.severity.toUpperCase()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {log.note && <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '6px' }}>{log.note}</div>}
            </div>
          );
        })}

        {visibleLogs.length === 0 && <div style={{ color: '#475569', fontSize: '12px', marginTop: '12px', textAlign: 'center', padding: '20px' }}>{cityOnly && logs.length > 0 ? `No logs for ${location.name} yet — switch to "All Cities" to see your other entries` : 'No logs yet - add your first multi-observation log above'}</div>}
      </div>
    </div>
  );
}
