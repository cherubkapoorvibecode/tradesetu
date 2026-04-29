
import { GoogleGenAI, Type } from "@google/genai";
import type { IncomingMessage, ServerResponse } from "http";
import type { FeedbackEntry } from "../types";
import { logFeedback, logProductFeedback, logEvent, logChatQuestion, logLead, aggregateFeedbackToBacklog, notifyFeedbackForAutoAggregate, getNotionLoopStatus } from "./notionService";

// In-memory feedback store
const feedbackStore: FeedbackEntry[] = [];

const MODEL = "gemini-2.5-flash";

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "PLACEHOLDER_API_KEY") {
    throw new Error("GEMINI_API_KEY not configured. Set it in .env.local");
  }
  return new GoogleGenAI({ apiKey });
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: any) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, data: any) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

// ─── Compliance Report Schema ───

const complianceItemSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    reason: { type: Type.STRING },
    enforcedBy: { type: Type.STRING },
    risk: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
    detailedExplanation: { type: Type.STRING },
    regulations: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["name", "reason", "enforcedBy", "risk", "detailedExplanation", "regulations"],
};

const complianceReportSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    requiredCompliance: { type: Type.ARRAY, items: complianceItemSchema },
    notRequired: { type: Type.ARRAY, items: { type: Type.STRING } },
    documentsNeeded: { type: Type.ARRAY, items: { type: Type.STRING } },
    timeline: { type: Type.STRING },
    costRange: { type: Type.STRING },
    bottleneck: { type: Type.STRING },
  },
  required: ["summary", "requiredCompliance", "notRequired", "documentsNeeded", "timeline", "costRange", "bottleneck"],
};

const SYSTEM_INSTRUCTION = `You are an expert international trade compliance advisor for TradeSetu.
Identify required import compliance for the given product and trade route. Be actionable — tell the exporter exactly what to do, not just what the law says.

Rules:
- Use plain business language, no legalese
- Keep the "reason" field to ONE sentence
- Keep "detailedExplanation" to 2-3 short paragraphs focused on HOW to comply, not legal background
- Only include regulations that the exporter would actually need to reference
- "summary" should be 2-3 sentences max, starting with the most important action
- "timeline" and "costRange" should be specific numbers, not ranges like "varies"
- "bottleneck" should name the single thing most likely to delay their shipment
- Cover the destination country's regulatory agencies and marketplace requirements`;

const CHAT_SYSTEM_INSTRUCTION = `You are TradeSetu's compliance advisor. The user has a compliance report and is asking follow-up questions.

Rules:
- Be concise and actionable — short paragraphs, use bold for key terms, use numbered lists for steps
- Give specific next actions, not general advice
- If the question reveals new compliance needs, include "updatedReport" with the full updated report
- If no report changes needed, set "updatedReport" to null
- Never say "consult a lawyer" without first giving your best actionable answer`;

// ─── Compliance Report Endpoint ───

export async function handleComplianceRequest(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const body = await readBody(req);
    const input = JSON.parse(body);
    const ai = getClient();

    const prompt = `
Product Name: ${input.productName}
Category: ${input.category}
Intended Use: ${input.intendedUse || "General Consumer"}
Description: ${input.description}
Materials/Ingredients: ${input.materials}
Origin Country: ${input.countryOfManufacture}
Destination Country: ${input.destinationCountry}
Selling Channel: ${input.channel}
First Shipment: ${input.isFirstShipment ? "Yes" : "No"}

Identify all import compliance requirements for shipping from ${input.countryOfManufacture} to ${input.destinationCountry}. Cover the destination country's regulatory bodies, customs requirements, and marketplace requirements. ${input.isFirstShipment ? "This is their first shipment — include extra guidance for first-time importers, registration steps, and common pitfalls." : ""} Provide the response strictly in JSON format matching the schema.`;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: complianceReportSchema as any,
      },
    });

    const report = JSON.parse(response.text || "{}");
    sendJson(res, 200, report);
  } catch (e: any) {
    console.error("Compliance API error:", e);
    sendJson(res, 500, { error: e.message || "Failed to generate report" });
  }
}

// ─── Chat Endpoint ───

const chatResponseSchema = {
  type: Type.OBJECT,
  properties: {
    reply: { type: Type.STRING },
    updatedReport: {
      type: Type.OBJECT,
      nullable: true,
      properties: complianceReportSchema.properties,
    },
  },
  required: ["reply"],
};

export async function handleChatRequest(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const body = await readBody(req);
    const { message, conversationHistory, originalReport, originalInput, sessionId } = JSON.parse(body);
    const ai = getClient();

    // Fire-and-forget: log the question to Notion Events DB so the aggregator
    // can mine recurring chat themes for content-gap signals.
    if (message && sessionId) {
      logChatQuestion({
        message,
        sessionId,
        productCategory: originalInput?.category,
        tradeRoute: originalInput ? `${originalInput.countryOfManufacture} → ${originalInput.destinationCountry}` : undefined,
      }).catch(() => {});
    }

    // Build the conversation as a single prompt with context
    const contextBlock = `ORIGINAL PRODUCT:\n${JSON.stringify(originalInput, null, 2)}\n\nORIGINAL COMPLIANCE REPORT:\n${JSON.stringify(originalReport, null, 2)}`;

    const historyBlock = (conversationHistory || [])
      .map((m: any) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n\n");

    const fullPrompt = `${contextBlock}\n\nCONVERSATION HISTORY:\n${historyBlock}\n\nNEW USER QUESTION: ${message}\n\nRespond with JSON: { "reply": "your response", "updatedReport": null or the full updated ComplianceReport if changes are needed }`;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: fullPrompt,
      config: {
        systemInstruction: CHAT_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: chatResponseSchema as any,
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    sendJson(res, 200, parsed);
  } catch (e: any) {
    console.error("Chat API error:", e);
    sendJson(res, 500, { error: e.message || "Failed to process chat message" });
  }
}

// ─── Feedback Endpoint ───

export async function handleFeedbackRequest(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const body = await readBody(req);
    const { itemName, isPositive, reason, category, tradeRoute, sessionId } = JSON.parse(body);

    const entry: FeedbackEntry = {
      itemName,
      isPositive,
      reason,
      timestamp: Date.now(),
    };

    feedbackStore.push(entry);
    console.log(`[Feedback] ${isPositive ? "👍" : "👎"} "${itemName}"${reason ? ` — ${reason}` : ""} (total: ${feedbackStore.length})`);

    // Log to Notion without blocking the user. Trigger aggregation only after
    // the row exists, so the newest signal is included in the triage pass.
    logFeedback({ itemName, isPositive, reason, category, tradeRoute, sessionId })
      .then(() => notifyFeedbackForAutoAggregate())
      .catch(() => {});

    sendJson(res, 200, { success: true, totalFeedback: feedbackStore.length });
  } catch (e: any) {
    console.error("Feedback API error:", e);
    sendJson(res, 500, { error: e.message || "Failed to save feedback" });
  }
}

// ─── Product Feedback Endpoint ───

export async function handleProductFeedbackRequest(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const body = await readBody(req);
    const { comment, rating, category, sessionId } = JSON.parse(body);

    console.log(`[Product Feedback] Rating: ${rating}/5 — "${comment?.slice(0, 50)}..."`);
    logProductFeedback({ comment, rating, category, sessionId })
      .then(() => notifyFeedbackForAutoAggregate())
      .catch(() => {});

    sendJson(res, 200, { success: true });
  } catch (e: any) {
    console.error("Product feedback API error:", e);
    sendJson(res, 500, { error: e.message || "Failed to save product feedback" });
  }
}

// ─── Agent Consultation Lead Endpoint ───

export async function handleLeadRequest(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const body = await readBody(req);
    const { name, email, phone, company, question, productCategory, tradeRoute, productName, sessionId } = JSON.parse(body);

    // Minimal validation — name + valid-looking email required
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return sendJson(res, 400, { error: "Name is required" });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return sendJson(res, 400, { error: "A valid email is required" });
    }

    console.log(`[Lead] New consultation request from ${name} <${email}>`);
    await logLead({ name: name.trim(), email: email.trim(), phone, company, question, productCategory, tradeRoute, productName, sessionId });

    sendJson(res, 200, { success: true });
  } catch (e: any) {
    console.error("Lead API error:", e);
    sendJson(res, 500, { error: e.message || "Failed to save consultation request" });
  }
}

// ─── Events Endpoint ───

export async function handleEventsRequest(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const body = await readBody(req);
    const { event, sessionId, properties } = JSON.parse(body);

    logEvent({ event, sessionId, properties }).catch(() => {});

    sendJson(res, 200, { success: true });
  } catch (e: any) {
    sendJson(res, 500, { error: e.message || "Failed to log event" });
  }
}

// ─── HS Code Classification ───

const hsClassificationSchema = {
  type: Type.OBJECT,
  properties: {
    primaryCode: {
      type: Type.OBJECT,
      properties: {
        hsCode: { type: Type.STRING },
        description: { type: Type.STRING },
        chapter: { type: Type.STRING },
        dutyRate: { type: Type.STRING },
        confidence: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
      },
      required: ["hsCode", "description", "chapter", "dutyRate", "confidence"],
    },
    alternativeCodes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          hsCode: { type: Type.STRING },
          description: { type: Type.STRING },
          dutyRate: { type: Type.STRING },
          confidence: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
          whyDifferent: { type: Type.STRING },
        },
        required: ["hsCode", "description", "dutyRate", "confidence", "whyDifferent"],
      },
    },
    classificationReasoning: { type: Type.STRING },
    keyFactors: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    warnings: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    freeTradeAgreements: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          agreement: { type: Type.STRING },
          benefit: { type: Type.STRING },
          eligible: { type: Type.BOOLEAN },
        },
        required: ["agreement", "benefit", "eligible"],
      },
    },
  },
  required: ["primaryCode", "alternativeCodes", "classificationReasoning", "keyFactors", "warnings", "freeTradeAgreements"],
};

const HS_SYSTEM_INSTRUCTION = `You are an expert customs classifier for international trade, specializing in Harmonized System (HS) / HTS code classification.

Given a product description, materials, origin, and destination, determine the most accurate HS code at the 6-digit level (international) and suggest the 8-10 digit HTS code for the destination country.

Rules:
- Apply GRI (General Rules of Interpretation) systematically
- Consider the product's essential character for composite goods
- Give the MOST SPECIFIC code possible, not a catch-all
- Include the duty rate for the destination country (use "TBD" if unsure of exact rate)
- Provide 2-3 alternative codes that a customs broker might also consider
- "keyFactors" should list the 3-5 product attributes that determined the classification (material, use, construction, etc.)
- "warnings" should flag any classification risks (e.g., "This product could be reclassified if it contains >50% synthetic fiber")
- Check for applicable Free Trade Agreements between origin and destination
- "classificationReasoning" should walk through the GRI logic in 2-3 sentences
- Be conservative — when in doubt, note the ambiguity rather than guessing`;

export async function handleHsClassifyRequest(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const body = await readBody(req);
    const input = JSON.parse(body);
    const ai = getClient();

    const prompt = `
Product Name: ${input.productName}
Category: ${input.category}
Description: ${input.description}
Materials/Ingredients: ${input.materials}
Origin Country: ${input.originCountry}
Destination Country: ${input.destinationCountry}
Intended Use: ${input.intendedUse || "General Consumer"}
${input.additionalDetails ? `Additional Details: ${input.additionalDetails}` : ""}

Classify this product with the most accurate HS/HTS code for import into ${input.destinationCountry}. Provide the response strictly in JSON format matching the schema.`;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        systemInstruction: HS_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: hsClassificationSchema as any,
      },
    });

    const result = JSON.parse(response.text || "{}");
    sendJson(res, 200, result);
  } catch (e: any) {
    console.error("HS Classification API error:", e);
    sendJson(res, 500, { error: e.message || "Failed to classify product" });
  }
}

// ─── Aggregate Feedback → Backlog ───

export async function handleAggregateRequest(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const result = await aggregateFeedbackToBacklog();
    sendJson(res, 200, result);
  } catch (e: any) {
    console.error("Aggregate API error:", e);
    sendJson(res, 500, { error: e.message || "Failed to aggregate feedback" });
  }
}

// ─── Notion Feedback Loop Health ───

export async function handleNotionHealthRequest(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const status = await getNotionLoopStatus();
    const ok = status.configured && status.initialized && Object.values(status.databases).every(Boolean);
    sendJson(res, ok ? 200 : 503, { ok, ...status });
  } catch (e: any) {
    console.error("Notion health API error:", e);
    sendJson(res, 500, { ok: false, error: e.message || "Failed to check Notion loop" });
  }
}
