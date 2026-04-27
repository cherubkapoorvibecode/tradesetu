
import { useState, useEffect, useRef } from 'react';
import { LanguagePreference } from '../types';
import { batchTranslate } from '../services/translationCache';

// useTranslations — translate a static string map whenever languagePref changes.
// Keys are stable identifiers; values are the English source strings.
// Returns the translated map (falls back to English on error or when lang is null).
//
// Usage:
//   const t = useTranslations({ headline: "Hello", cta: "Get started" }, languagePref);
//   <h1>{t.headline}</h1>

export function useTranslations<T extends Record<string, string>>(
  englishStrings: T,
  languagePref: LanguagePreference
): T {
  const [translated, setTranslated] = useState<T>(englishStrings);
  // Keep a stable reference to englishStrings so the effect doesn't re-fire
  const stringsRef = useRef(englishStrings);

  useEffect(() => {
    const strings = stringsRef.current;

    if (!languagePref) {
      setTranslated(strings);
      return;
    }

    let cancelled = false;

    const keys = Object.keys(strings) as (keyof T)[];
    const values = keys.map(k => strings[k]);

    batchTranslate(values, languagePref).then(results => {
      if (cancelled) return;
      const out = { ...strings };
      keys.forEach((k, i) => { out[k] = results[i] as T[keyof T]; });
      setTranslated(out as T);
    }).catch(() => {
      if (!cancelled) setTranslated(strings);
    });

    return () => { cancelled = true; };
  }, [languagePref]);

  return translated;
}
