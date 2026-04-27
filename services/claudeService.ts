
import { UserInput, ComplianceReport, ChatRequest, ChatResponse, FeedbackRequest, HsClassifyInput, HsClassificationResult } from "../types";

export const generateComplianceReport = async (input: UserInput): Promise<ComplianceReport> => {
  const response = await fetch("/api/compliance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to generate compliance report.");
  }

  return response.json();
};

export const sendChatMessage = async (request: ChatRequest): Promise<ChatResponse> => {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to send chat message.");
  }

  return response.json();
};

export const submitFeedback = async (feedback: FeedbackRequest): Promise<{ success: boolean }> => {
  const response = await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(feedback),
  });

  if (!response.ok) {
    throw new Error("Failed to submit feedback.");
  }

  return response.json();
};

export const submitProductFeedback = async (data: {
  comment: string;
  rating?: number;
  category?: string;
  sessionId?: string;
}): Promise<{ success: boolean }> => {
  const response = await fetch("/api/product-feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Failed to submit product feedback.");
  return response.json();
};

export const trackEvent = async (data: {
  event: string;
  sessionId: string;
  properties: Record<string, any>;
}): Promise<void> => {
  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).catch(() => {}); // fire-and-forget
};

export const triggerAggregation = async (): Promise<{ created: number; updated: number }> => {
  const response = await fetch("/api/aggregate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error("Failed to aggregate feedback.");
  return response.json();
};

export const classifyHsCode = async (input: HsClassifyInput): Promise<HsClassificationResult> => {
  const response = await fetch("/api/hs-classify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to classify HS code.");
  }
  return response.json();
};

// ─── Sarvam AI — Indian Language Support ───

export const translateText = async (
  text: string,
  targetLanguage: string,
  sourceLanguage?: string,
  mode?: "formal" | "modern-colloquial"
): Promise<string> => {
  const response = await fetch("/api/sarvam/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, targetLanguage, sourceLanguage, mode }),
  });
  if (!response.ok) throw new Error("Translation failed");
  const data = await response.json();
  return data.translatedText ?? text;
};

export const detectLanguage = async (text: string): Promise<string> => {
  const response = await fetch("/api/sarvam/detect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  // Fail safe — if detection fails, assume English
  if (!response.ok) return "en-IN";
  const data = await response.json();
  return data.languageCode ?? "en-IN";
};

export const synthesizeSpeech = async (
  text: string,
  languageCode: string
): Promise<string | null> => {
  const response = await fetch("/api/sarvam/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, languageCode }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data.audioBase64 ?? null;
};
