import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Language, TFunc } from './translations';
import { translate } from './translations';
import type { UnitSystem } from './units';

interface SettingsContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  units: UnitSystem;
  setUnits: (units: UnitSystem) => void;
  t: TFunc;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');
  const [units, setUnits] = useState<UnitSystem>('metric');

  const t = (key: string, params?: Record<string, string | number>) =>
    translate(language, key, params);

  return (
    <SettingsContext.Provider value={{ language, setLanguage, units, setUnits, t }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
