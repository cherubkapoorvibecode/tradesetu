
// Sarvam AI service for TradeSetu — Indian language support
// APIs: Translation (Mayura v1), Language Detection, TTS (Bulbul v3)
// Auth: api-subscription-key header (NOT Bearer)

import type { IncomingMessage, ServerResponse } from 'http';

const SARVAM_BASE = 'https://api.sarvam.ai';

function getSarvamKey(): string {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new Error('SARVAM_API_KEY not set in .env.local — get one at sarvam.ai');
  return key;
}

function sendJson(res: ServerResponse, status: number, data: any) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: any) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function sarvamFetch(endpoint: string, body: any, key: string): Promise<any> {
  const res = await fetch(`${SARVAM_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': key,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.message || data?.error || `Sarvam API error ${res.status}`;
    console.error(`[Sarvam] ${endpoint} failed:`, JSON.stringify(data).slice(0, 300));
    throw new Error(msg);
  }
  return data;
}

// ─── Translation (Mayura v1) ───
// Translates between any Indian language and English
// mode: 'formal' for compliance content, 'modern-colloquial' for chat

export async function handleTranslateRequest(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const key = getSarvamKey();
    const body = await readBody(req);
    const { text, targetLanguage, sourceLanguage, mode } = JSON.parse(body);

    if (!text || !targetLanguage) {
      return sendJson(res, 400, { error: 'text and targetLanguage are required' });
    }

    // Skip API call for very short inputs or if source == target
    if (text.trim().length < 2) {
      return sendJson(res, 200, { translatedText: text });
    }

    const data = await sarvamFetch('/translate', {
      input: text.slice(0, 1000),
      source_language_code: sourceLanguage || 'auto',
      target_language_code: targetLanguage,
      mode: mode || 'formal',
      model: 'sarvam-translate:v1', // supports all 22 Indian languages incl. Urdu
      enable_preprocessing: true,
      speaker_gender: 'Male',
    }, key);

    sendJson(res, 200, { translatedText: data.translated_text });
  } catch (e: any) {
    console.error('[Sarvam] Translation error:', e.message);
    sendJson(res, 500, { error: e.message || 'Translation failed' });
  }
}

// ─── Language Detection ───
// Returns BCP-47 language code (e.g. 'hi-IN', 'gu-IN')

export async function handleDetectRequest(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const key = getSarvamKey();
    const body = await readBody(req);
    const { text } = JSON.parse(body);

    if (!text || text.trim().length < 2) {
      return sendJson(res, 200, { languageCode: 'en-IN' });
    }

    const data = await sarvamFetch('/detect-language', {
      input: text.slice(0, 500),
    }, key);

    sendJson(res, 200, {
      languageCode: data.language_code,
      scriptCode: data.script_code,
    });
  } catch (e: any) {
    console.error('[Sarvam] Detect error:', e.message);
    // Fail safe — return English so the app doesn't break
    sendJson(res, 200, { languageCode: 'en-IN' });
  }
}

// ─── Text-to-Speech (Bulbul v3) ───
// Returns base64-encoded WAV audio

// Best speakers per language for natural-sounding compliance content
const SPEAKERS: Record<string, string> = {
  'hi-IN': 'anushka',
  'gu-IN': 'anushka',
  'ta-IN': 'amol',
  'te-IN': 'amol',
  'kn-IN': 'amol',
  'ml-IN': 'amol',
  'mr-IN': 'anushka',
  'pa-IN': 'anushka',
  'bn-IN': 'anushka',
  'od-IN': 'anushka',
  'ur-IN': 'anushka',
  'en-IN': 'anushka',
};

// ─── Speech-to-Text (Saarika v2) ───
// Accepts a base64-encoded audio blob (webm/wav/mp3) + optional language hint.
// Returns the transcribed text. If languageCode is omitted, Sarvam auto-detects.
//
// We pass audio as base64 in the JSON body so it survives our JSON-only middleware.
// The server decodes to a Buffer and forwards as multipart/form-data to Sarvam.

export async function handleAsrRequest(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const key = getSarvamKey();
    const body = await readBody(req);
    const { audioBase64, mimeType, languageCode } = JSON.parse(body);

    if (!audioBase64) {
      return sendJson(res, 400, { error: 'audioBase64 is required' });
    }

    // Decode base64 to Buffer for multipart upload
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    // Sarvam validates against literal MIME strings — strip ;codecs=... params
    // (Chrome's MediaRecorder emits "audio/webm;codecs=opus" but Sarvam wants
    // bare "audio/webm").
    const rawMime = mimeType || 'audio/webm';
    const baseMime = rawMime.split(';')[0].trim() || 'audio/webm';
    // Pick a sensible filename extension matching the MIME base
    const ext = baseMime.includes('mp4') ? 'mp4'
              : baseMime.includes('ogg') ? 'ogg'
              : baseMime.includes('wav') ? 'wav'
              : 'webm';

    // Build multipart body. Node 20+ has FormData + Blob globals.
    const form = new FormData();
    form.append('file', new Blob([audioBuffer], { type: baseMime }), `audio.${ext}`);
    form.append('model', 'saarika:v2.5');
    if (languageCode && languageCode !== 'unknown') {
      form.append('language_code', languageCode);
    }

    const sarvamRes = await fetch(`${SARVAM_BASE}/speech-to-text`, {
      method: 'POST',
      headers: { 'api-subscription-key': key },
      body: form,
    });

    const data = await sarvamRes.json();
    if (!sarvamRes.ok) {
      const msg = data?.error?.message || data?.message || `Sarvam ASR error ${sarvamRes.status}`;
      console.error('[Sarvam] ASR failed:', JSON.stringify(data).slice(0, 300));
      throw new Error(msg);
    }

    sendJson(res, 200, {
      transcript: data.transcript || '',
      languageCode: data.language_code || 'unknown',
    });
  } catch (e: any) {
    console.error('[Sarvam] ASR error:', e.message);
    sendJson(res, 500, { error: e.message || 'ASR failed' });
  }
}

export async function handleTtsRequest(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const key = getSarvamKey();
    const body = await readBody(req);
    const { text, languageCode, speaker } = JSON.parse(body);

    if (!text || !languageCode) {
      return sendJson(res, 400, { error: 'text and languageCode are required' });
    }

    const data = await sarvamFetch('/text-to-speech', {
      inputs: [text.slice(0, 2500)], // Bulbul v3 max 2500 chars
      target_language_code: languageCode,
      speaker: speaker || SPEAKERS[languageCode] || 'anushka',
      model: 'bulbul:v3',
      speech_sample_rate: 22050,
      enable_preprocessing: true,
    }, key);

    sendJson(res, 200, { audioBase64: data.audios?.[0] || null });
  } catch (e: any) {
    console.error('[Sarvam] TTS error:', e.message);
    sendJson(res, 500, { error: e.message || 'TTS failed' });
  }
}
