
// Translation cache with concurrency limiter
// Problem: all components fire useTranslations simultaneously on language change
// = 50-80 parallel Sarvam requests = rate limit errors = partial translations
// Fix: semaphore caps at MAX_CONCURRENT simultaneous calls, rest queue up

const MAX_CONCURRENT = 5;
const cache = new Map<string, string>();

// ─── Semaphore ───
let running = 0;
const waitQueue: Array<() => void> = [];

function acquire(): Promise<void> {
  if (running < MAX_CONCURRENT) {
    running++;
    return Promise.resolve();
  }
  return new Promise(resolve => waitQueue.push(() => { running++; resolve(); }));
}

function release(): void {
  running--;
  if (waitQueue.length > 0) waitQueue.shift()!();
}

// ─── Core ───
function cacheKey(lang: string, text: string) {
  return `${lang}::${text}`;
}

async function translateOne(text: string, targetLang: string): Promise<string> {
  const key = cacheKey(targetLang, text);
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  await acquire();
  try {
    const res = await fetch('/api/sarvam/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        targetLanguage: targetLang,
        sourceLanguage: 'en-IN',
        mode: 'formal',
      }),
    });

    if (!res.ok) {
      console.warn(`[translation] ${targetLang} failed for: "${text.slice(0, 40)}…"`);
      return text;
    }

    const data = await res.json();
    const translated: string = data.translatedText ?? text;
    cache.set(key, translated);
    return translated;
  } catch (e) {
    console.warn(`[translation] network error for: "${text.slice(0, 40)}…"`, e);
    return text; // fail safe — show English
  } finally {
    release();
  }
}

// Translate all strings — concurrency-limited, all independently cached
export async function batchTranslate(
  strings: string[],
  targetLang: string
): Promise<string[]> {
  if (!strings.length) return [];
  return Promise.all(strings.map(s => translateOne(s, targetLang)));
}

export function clearTranslationCache() {
  cache.clear();
}
