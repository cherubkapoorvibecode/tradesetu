
import { trackEvent } from "./claudeService";

// Session ID — persists for the browser tab lifetime
const SESSION_ID = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

let sessionStart = Date.now();

export function getSessionId() {
  return SESSION_ID;
}

// ─── PM-relevant events ───

export function trackFormStart(category?: string) {
  trackEvent({ event: "form_start", sessionId: SESSION_ID, properties: { category } });
}

export function trackFormSubmit(input: Record<string, any>) {
  trackEvent({
    event: "form_submit",
    sessionId: SESSION_ID,
    properties: {
      productName: input.productName,
      category: input.category,
      origin: input.countryOfManufacture,
      destination: input.destinationCountry,
      channel: input.channel,
      isFirstShipment: input.isFirstShipment,
    },
  });
}

export function trackReportView(itemCount: number) {
  trackEvent({
    event: "report_view",
    sessionId: SESSION_ID,
    properties: { itemCount, timeToReport: Date.now() - sessionStart },
  });
}

export function trackItemExpand(itemName: string, risk: string) {
  trackEvent({
    event: "item_expand",
    sessionId: SESSION_ID,
    properties: { itemName, risk },
  });
}

export function trackStatusChange(itemName: string, from: string, to: string) {
  trackEvent({
    event: "status_change",
    sessionId: SESSION_ID,
    properties: { itemName, from, to },
  });
}

export function trackChatMessage(messageLength: number, isGuidedAction: boolean) {
  trackEvent({
    event: "chat_message",
    sessionId: SESSION_ID,
    properties: { messageLength, isGuidedAction },
  });
}

export function trackFeedbackGiven(itemName: string, isPositive: boolean, reason?: string) {
  trackEvent({
    event: "feedback_given",
    sessionId: SESSION_ID,
    properties: { itemName, isPositive, reason },
  });
}

export function trackProductFeedback(rating: number, commentLength: number) {
  trackEvent({
    event: "product_feedback",
    sessionId: SESSION_ID,
    properties: { rating, commentLength },
  });
}

export function trackSessionDuration() {
  trackEvent({
    event: "session_end",
    sessionId: SESSION_ID,
    properties: { durationMs: Date.now() - sessionStart },
  });
}
