
import React from 'react';
import { LanguagePreference, LanguageOption } from '../types';

interface Props {
  value: LanguagePreference;
  onChange: (lang: LanguagePreference) => void;
  compact?: boolean;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: null,    label: "English",    labelEn: "English" },
  { code: 'hi-IN', label: "हिन्दी",      labelEn: "Hindi" },
  { code: 'gu-IN', label: "ગુજરાતી",    labelEn: "Gujarati" },
  { code: 'ta-IN', label: "தமிழ்",      labelEn: "Tamil" },
  { code: 'te-IN', label: "తెలుగు",     labelEn: "Telugu" },
  { code: 'kn-IN', label: "ಕನ್ನಡ",      labelEn: "Kannada" },
  { code: 'ml-IN', label: "മലയാളം",     labelEn: "Malayalam" },
  { code: 'mr-IN', label: "मराठी",      labelEn: "Marathi" },
  { code: 'pa-IN', label: "ਪੰਜਾਬੀ",    labelEn: "Punjabi" },
  { code: 'bn-IN', label: "বাংলা",      labelEn: "Bengali" },
  { code: 'od-IN', label: "ଓଡ଼ିଆ",     labelEn: "Odia" },
  { code: 'ur-IN', label: "اردو",       labelEn: "Urdu" },
];

// Quick lookup: code → English label
export const LANG_LABEL_EN: Record<string, string> = Object.fromEntries(
  LANGUAGE_OPTIONS.filter(o => o.code).map(o => [o.code as string, o.labelEn])
);

const LanguageSelector: React.FC<Props> = ({ value, onChange, compact = false }) => {
  const selected = LANGUAGE_OPTIONS.find(o => o.code === value) ?? LANGUAGE_OPTIONS[0];

  return (
    <div className="relative flex items-center">
      {/* Globe icon */}
      <span className="absolute left-2.5 pointer-events-none text-slate-400">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
            d="M12 2a10 10 0 100 20A10 10 0 0012 2zm0 0c-2.4 4-2.4 16 0 20m0-20c2.4 4 2.4 16 0 20M2 12h20" />
        </svg>
      </span>

      <select
        value={value ?? ""}
        onChange={(e) => onChange((e.target.value || null) as LanguagePreference)}
        className={`pl-7 pr-2 py-1.5 text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 rounded-lg appearance-none cursor-pointer hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors ${
          compact ? "w-auto" : "w-36"
        } ${value ? "text-blue-600 bg-blue-50 border-blue-200" : ""}`}
        title="Choose language / भाषा चुनें"
      >
        {LANGUAGE_OPTIONS.map((opt) => (
          <option key={opt.code ?? "__en__"} value={opt.code ?? ""}>
            {opt.label}{opt.code ? ` · ${opt.labelEn}` : ""}
          </option>
        ))}
      </select>

      {/* Active indicator dot */}
      {value && (
        <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full border border-white" />
      )}
    </div>
  );
};

export default LanguageSelector;
