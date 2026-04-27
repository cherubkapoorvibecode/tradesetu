
import { AnalysisResult } from '../types-labelguard';

export async function analyzeLabelImage(base64: string, mimeType: string): Promise<AnalysisResult> {
  const res = await fetch('/api/label-analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64, mimeType }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Analysis failed: ${res.status}`);
  }
  return res.json() as Promise<AnalysisResult>;
}

export function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      resolve({ base64, mimeType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
