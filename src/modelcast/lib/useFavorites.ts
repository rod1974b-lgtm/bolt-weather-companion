import { useCallback, useEffect, useState } from 'react';
import type { GeoLocation } from '@/modelcast/lib/types';

const STORAGE_KEY = 'modelcast:favorites';
const LAST_LOCATION_KEY = 'modelcast:last-location';

/**
 * Compact URL encode/decode for GeoLocation list
 * Format: id:name:lat:lon:country,id:name:lat:lon:country
 */
function parseFavoritesFromUrl(): GeoLocation[] {
  if (typeof window === 'undefined') return [];
  try {
    const params = new URLSearchParams(window.location.search);
    const rawFavs = params.get('favs');
    if (!rawFavs) return [];
    return rawFavs.split(';').map((item) => {
      const [id, name, lat, lon, country] = item.split(':');
      return {
        id: Number(id),
        name: decodeURIComponent(name || ''),
        latitude: Number(lat),
        longitude: Number(lon),
        country: country ? decodeURIComponent(country) : undefined,
      };
    }).filter((loc) => !isNaN(loc.id) && loc.name && !isNaN(loc.latitude) && !isNaN(loc.longitude));
  } catch {
    return [];
  }
}

function syncFavoritesToUrl(favs: GeoLocation[]) {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (favs.length === 0) {
      url.searchParams.delete('favs');
    } else {
      const serialized = favs
        .map((f) => `${f.id}:${encodeURIComponent(f.name)}:${f.latitude.toFixed(4)}:${f.longitude.toFixed(4)}:${encodeURIComponent(f.country || '')}`)
        .join(';');
      url.searchParams.set('favs', serialized);
    }
    window.history.replaceState(null, '', url.toString());
  } catch {
    // ignore
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<GeoLocation[]>(() => {
    // 1. Prioritize URL favorites (if shared/bookmarked link opened)
    const fromUrl = parseFavoritesFromUrl();
    if (fromUrl.length > 0) return fromUrl;

    // 2. Fall back to localStorage
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw) as GeoLocation[];
      } catch {}
    }
    return [];
  });

  // Keep localStorage and URL in sync whenever favorites change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch {}
    syncFavoritesToUrl(favorites);
  }, [favorites]);

  const addFavorite = useCallback((loc: GeoLocation) => {
    setFavorites((prev) => {
      if (prev.some((f) => f.id === loc.id)) return prev;
      return [...prev, loc];
    });
  }, []);

  const removeFavorite = useCallback((id: number) => {
    setFavorites((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const isFavorite = useCallback(
    (id: number) => favorites.some((f) => f.id === id),
    [favorites],
  );

  /**
   * One-click copy link for Option 4
   */
  const copyShareLink = useCallback(async (): Promise<boolean> => {
    try {
      syncFavoritesToUrl(favorites);
      await navigator.clipboard.writeText(window.location.href);
      return true;
    } catch {
      return false;
    }
  }, [favorites]);

  /**
   * Option B: Export backup file (JSON)
   */
  const exportBackup = useCallback(() => {
    try {
      const data = {
        favorites,
        lastLocation: localStorage.getItem(LAST_LOCATION_KEY),
        units: localStorage.getItem('modelcast:units'),
        language: localStorage.getItem('modelcast:language'),
        exportedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `modelcast-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return true;
    } catch {
      return false;
    }
  }, [favorites]);

  /**
   * Option B: Restore backup file (JSON)
   */
  const restoreBackup = useCallback((file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed.favorites)) {
            setFavorites(parsed.favorites);
          }
          if (parsed.units) localStorage.setItem('modelcast:units', parsed.units);
          if (parsed.language) localStorage.setItem('modelcast:language', parsed.language);
          if (parsed.lastLocation) localStorage.setItem(LAST_LOCATION_KEY, parsed.lastLocation);
          resolve(true);
        } catch {
          resolve(false);
        }
      };
      reader.onerror = () => resolve(false);
      reader.readAsText(file);
    });
  }, []);

  return {
    favorites,
    addFavorite,
    removeFavorite,
    isFavorite,
    copyShareLink,
    exportBackup,
    restoreBackup,
  };
}
