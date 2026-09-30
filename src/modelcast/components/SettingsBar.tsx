import { useState, useRef, useEffect } from 'react';
import {
  Globe,
  ChevronDown,
  Thermometer,
  Download,
  Upload,
  Database,
  Check,
  AlertCircle,
} from 'lucide-react';
import { useSettings } from '@/modelcast/lib/settings';
import { LANGUAGES, type Language } from '@/modelcast/lib/translations';
import { useFavorites } from '@/modelcast/lib/useFavorites';

export function SettingsBar() {
  const { language, setLanguage, units, setUnits, t } = useSettings();
  const { favorites, exportBackup, restoreBackup } = useFavorites();

  const [langOpen, setLangOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(
    null,
  );

  const langRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
      if (dataRef.current && !dataRef.current.contains(e.target as Node)) {
        setDataOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Handle restoring backup JSON file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const ok = restoreBackup(content);
      if (ok) {
        setImportStatus({ success: true, message: 'Cities restored!' });
        setTimeout(() => {
          setImportStatus(null);
          setDataOpen(false);
        }, 2500);
      } else {
        setImportStatus({ success: false, message: 'Invalid backup file.' });
        setTimeout(() => setImportStatus(null), 3000);
      }
    };
    reader.readAsText(file);

    // Reset input so the same file can be uploaded again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const currentLang = LANGUAGES.find((l) => l.code === language);

  return (
    <div className="flex items-center gap-2">
      {/* Hidden file input for backup restore */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Units Toggle (Metric vs. Imperial) */}
      <div className="flex rounded-lg border border-slate-700/60 bg-slate-800/60 p-0.5">
        <button
          onClick={() => setUnits('metric')}
          className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all sm:px-3 sm:py-1.5 sm:text-sm ${
            units === 'metric'
              ? 'bg-sky-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Thermometer size={14} />
          {t('metric')}
        </button>
        <button
          onClick={() => setUnits('us')}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all sm:px-3 sm:py-1.5 sm:text-sm ${
            units === 'us'
              ? 'bg-sky-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t('imperial')}
        </button>
      </div>

      {/* Language Selector Dropdown */}
      <div ref={langRef} className="relative">
        <button
          onClick={() => {
            setLangOpen(!langOpen);
            setDataOpen(false);
          }}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-800/60 px-2.5 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-700 sm:px-3 sm:text-sm"
        >
          <Globe size={14} />
          <span className="font-medium">{currentLang?.flag}</span>
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 ${langOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {langOpen && (
          <div className="absolute right-0 z-50 mt-2 w-40 overflow-hidden rounded-xl border border-slate-700/60 bg-slate-800 shadow-2xl shadow-black/40">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => {
                  setLanguage(lang.code as Language);
                  setLangOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors ${
                  language === lang.code
                    ? 'bg-sky-500/15 text-sky-300'
                    : 'text-slate-300 hover:bg-slate-700/40'
                }`}
              >
                <span className="w-6 text-xs font-bold">{lang.flag}</span>
                {lang.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Data & Backup Menu */}
      <div ref={dataRef} className="relative">
        <button
          onClick={() => {
            setDataOpen(!dataOpen);
            setLangOpen(false);
          }}
          title="Backup & Restore Data"
          className="flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-800/60 px-2.5 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-700 sm:px-3 sm:text-sm"
        >
          <Database size={14} className="text-amber-400" />
          <span className="hidden font-medium sm:inline">Backup</span>
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 ${dataOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {dataOpen && (
          <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-slate-700/70 bg-slate-850 p-2 shadow-2xl shadow-black/50">
            <div className="mb-2 px-2 pt-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Data & Storage
              </p>
              <p className="text-xs text-slate-400">
                {favorites.length} {favorites.length === 1 ? 'city' : 'cities'} saved
              </p>
            </div>

            {/* Status Feedback Banner */}
            {importStatus && (
              <div
                className={`mb-2 flex items-center gap-2 rounded-lg p-2 text-xs font-medium ${
                  importStatus.success
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/20 text-rose-300'
                }`}
              >
                {importStatus.success ? <Check size={14} /> : <AlertCircle size={14} />}
                <span>{importStatus.message}</span>
              </div>
            )}

            {/* Download Backup Button */}
            <button
              onClick={() => {
                exportBackup();
                setDataOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700/60"
            >
              <Download size={14} className="text-sky-400" />
              <div>
                <p>Export Backup (.json)</p>
                <p className="text-[10px] text-slate-400">Save all cities to file</p>
              </div>
            </button>

            {/* Restore Backup Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700/60"
            >
              <Upload size={14} className="text-emerald-400" />
              <div>
                <p>Import Backup (.json)</p>
                <p className="text-[10px] text-slate-400">Restore cities anytime</p>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
