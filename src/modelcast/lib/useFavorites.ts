import { useCallback, useEffect, useState } from 'react';
import type { GeoLocation } from '@/modelcast/lib/types';

const STORAGE_KEY = 'modelcast:favorites';

/**
 * Compact URL encode/decode for favorite cities so bookmark links stay clean.
 * Format: id:name:lat:lon:country:timezone:countryCode (pipe-separated)
 */
function serializeFavoritesToQuery(favs: GeoLocation[]): string {
  return favs
    .map((f) =>
      [
        f.id,
        encodeURIComponent(f.name || ''),
        f.latitude,
        f.longitude,
        encodeURIComponent(f.country || ''),
        encodeURIComponent(f.timezone || 'auto'),
        encodeURIComponent(f.country_code || ''),
      ].join(':'),
    )
    .join('|');
}

function parseFavoritesFromQuery(raw: string): GeoLocation[] {
  if (!raw.trim()) return [];
  try {
    return raw
      .split('|')
      .map((item) => {
        const [id, name, lat, lon, country, timezone, country_code] = item.split(':');
        if (!name || isNaN(Number(lat)) || isNaN(Number(lon))) return null;
        return {
          id: Number(id) || Math.floor(Math.random() * 1000000),
          name: decodeURIComponent(name),
          latitude: Number(lat),
          longitude: Number(lon),
          country: decodeURIComponent(country || ''),
          timezone: decodeURIComponent(timezone || 'auto'),
          country_code: decodeURIComponent(country_code || ''),
        } as GeoLocation;
      })
      .filter((loc): loc is GeoLocation => loc !== null);
  } catch {
    return [];
  }
}

function syncFavoritesToUrl(favs: GeoLocation[]) {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (favs.length > 0) {
      url.searchParams.set('favs', serializeFavoritesToQuery(favs));
    } else {
      url.searchParams.delete('favs');
    }
    window.history.replaceState(null, '', url.toString());
  } catch {
    // ignore
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<GeoLocation[]>([]);

  // 1. Initialize favorites on mount: URL query params take precedence, fallback to localStorage
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const urlFavsRaw = urlParams.get('favs');
        if (urlFavsRaw) {
          const fromUrl = parseFavoritesFromQuery(urlFavsRaw);
          if (fromUrl.length > 0) {
            setFavorites(fromUrl);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(fromUrl));
            return;
          }
        }
      }

      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as GeoLocation[];
        if (Array.isArray(parsed)) {
          setFavorites(parsed);
          syncFavoritesToUrl(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to load favorites', e);
    }
  }, []);

  // 2. Add favorite without nesting state setters (React 19 safe)
  const addFavorite = useCallback((loc: GeoLocation) => {
    setFavorites((prev) => {
      if (prev.some((f) => f.id === loc.id)) return prev;
      const next = [...prev, loc];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.error('Failed to persist favorites', e);
      }
      syncFavoritesToUrl(next);
      return next;
    });
  }, []);

  // 3. Remove favorite
  const removeFavorite = useCallback((id: number) => {
    setFavorites((prev) => {
      const next = prev.filter((f) => f.id !== id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.error('Failed to persist favorites', e);
      }
      syncFavoritesToUrl(next);
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (id: number) => favorites.some((f) => f.id === id),
    [favorites],
  );

  // 4. Export backup to downloaded JSON file
  const exportBackup = useCallback(() => {
    try {
      const data = {
        app: 'ModelCast',
        exportedAt: new Date().toISOString(),
        favorites,
        settings: {
          units: localStorage.getItem('modelcast:units') || 'metric',
          language: localStorage.getItem('modelcast:language') || 'en',
          model: localStorage.getItem('modelcast:selected-model') || 'auto',
        },
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `modelcast-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed', err);
    }
  }, [favorites]);

  // 5. Restore backup from JSON content
  const restoreBackup = useCallback((jsonContent: string) => {
    try {
      const parsed = JSON.parse(jsonContent);
      if (parsed && Array.isArray(parsed.favorites)) {
        setFavorites(parsed.favorites);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed.favorites));
        syncFavoritesToUrl(parsed.favorites);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  return {
    favorites,
    addFavorite,
    removeFavorite,
    isFavorite,
    exportBackup,
    restoreBackup,
  };
}
