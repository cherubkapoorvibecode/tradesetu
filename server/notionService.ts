
// Notion API service for TradeSetu product intelligence
// Creates and manages: Product Feedback DB, Product Backlog DB, Event Tracking DB

const NOTION_VERSION = "2022-06-28";

// Store DB IDs on globalThis so they survive Vite HMR reloads
const g = globalThis as any;
if (!g.__notionDbIds) g.__notionDbIds = { feedback: null, backlog: null, events: null, leads: null, initialized: false };

function getFeedbackDbId(): string | null { return g.__notionDbIds.feedback; }
function getBacklogDbId(): string | null { return g.__notionDbIds.backlog; }
function getEventsDbId(): string | null { return g.__notionDbIds.events; }
function getLeadsDbId(): string | null { return g.__notionDbIds.leads; }

function getHeaders() {
  const key = process.env.NOTION_API_KEY;
  if (!key) throw new Error("NOTION_API_KEY not set");
  return {
    "Authorization": `Bearer ${key}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

async function notionFetch(endpoint: string, method: string, body?: any): Promise<any> {
  const res = await fetch(`https://api.notion.com/v1${endpoint}`, {
    method,
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`[Notion] ${method} ${endpoint} failed:`, JSON.stringify(data).slice(0, 300));
    throw new Error(data.message || `Notion API error ${res.status}`);
  }
  return data;
}

// ─── Database Search & Creation ───

async function findDatabase(title: string): Promise<string | null> {
  const data = await notionFetch("/search", "POST", {
    query: title,
    filter: { property: "object", value: "database" },
    page_size: 10,
  });
  const match = data.results?.find((db: any) =>
    db.title?.some((t: any) => t.plain_text === title)
  );
  return match?.id || null;
}

async function createFeedbackDb(pageId: string): Promise<string> {
  const data = await notionFetch("/databases", "POST", {
    parent: { type: "page_id", page_id: pageId },
    title: [{ type: "text", text: { content: "Product Feedback" } }],
    properties: {
      "Item": { title: {} },
      "Feedback": {
        select: {
          options: [
            { name: "👍 Positive", color: "green" },
            { name: "👎 Negative", color: "red" },
            { name: "💬 Comment", color: "blue" },
          ]
        }
      },
      "Reason": {
        select: {
          options: [
            { name: "Incorrect", color: "red" },
            { name: "Too vague", color: "orange" },
            { name: "Not applicable", color: "gray" },
            { name: "Missing context", color: "yellow" },
            { name: "Helpful", color: "green" },
          ]
        }
      },
      "Comment": { rich_text: {} },
      "Rating": { number: { format: "number" } },
      "Product Category": {
        select: {
          options: [
            { name: "Food", color: "green" },
            { name: "Cosmetics", color: "pink" },
            { name: "Electronics", color: "blue" },
            { name: "Apparel / Textile", color: "purple" },
            { name: "Toys / Children's products", color: "yellow" },
            { name: "Other consumer goods", color: "gray" },
          ]
        }
      },
      "Trade Route": { rich_text: {} },
      "Session": { rich_text: {} },
      "Date": { date: {} },
    }
  });
  console.log("[Notion] Created Product Feedback database");
  return data.id;
}

async function createBacklogDb(pageId: string): Promise<string> {
  const data = await notionFetch("/databases", "POST", {
    parent: { type: "page_id", page_id: pageId },
    title: [{ type: "text", text: { content: "Product Backlog" } }],
    properties: {
      "Task": { title: {} },
      "Priority": {
        select: {
          options: [
            { name: "P0 - Critical", color: "red" },
            { name: "P1 - High", color: "orange" },
            { name: "P2 - Medium", color: "yellow" },
            { name: "P3 - Low", color: "gray" },
          ]
        }
      },
      "Category": {
        select: {
          options: [
            { name: "AI Quality", color: "blue" },
            { name: "UX Improvement", color: "purple" },
            { name: "New Feature", color: "green" },
            { name: "Content Gap", color: "orange" },
            { name: "Bug Fix", color: "red" },
          ]
        }
      },
      "Status": {
        select: {
          options: [
            { name: "Backlog", color: "gray" },
            { name: "To Do", color: "blue" },
            { name: "In Progress", color: "yellow" },
            { name: "Done", color: "green" },
          ]
        }
      },
      "Evidence": { rich_text: {} },
      "Feedback Count": { number: { format: "number" } },
      "Affected Items": { rich_text: {} },
      "Source Signal": {
        select: {
          options: [
            { name: "Negative Feedback", color: "red" },
            { name: "Chat Question Cluster", color: "blue" },
            { name: "N/A Pattern", color: "gray" },
            { name: "Low Completion", color: "orange" },
            { name: "Feature Request", color: "green" },
          ]
        }
      },
      "Created": { date: {} },
    }
  });
  console.log("[Notion] Created Product Backlog database");
  return data.id;
}

async function createEventsDb(pageId: string): Promise<string> {
  const data = await notionFetch("/databases", "POST", {
    parent: { type: "page_id", page_id: pageId },
    title: [{ type: "text", text: { content: "Analytics Events" } }],
    properties: {
      "Event": { title: {} },
      "Session": { rich_text: {} },
      "Properties": { rich_text: {} },
      "Date": { date: {} },
    }
  });
  console.log("[Notion] Created Analytics Events database");
  return data.id;
}

// Agent Consultation Requests — leads captured from "Speak with an agent for free"
// CTA shown after the compliance report. Fed into the agency-led GTM funnel.
async function createLeadsDb(pageId: string): Promise<string> {
  const data = await notionFetch("/databases", "POST", {
    parent: { type: "page_id", page_id: pageId },
    title: [{ type: "text", text: { content: "Agent Consultation Requests" } }],
    properties: {
      "Name": { title: {} },
      "Email": { email: {} },
      "Phone": { phone_number: {} },
      "Company": { rich_text: {} },
      "Question": { rich_text: {} },
      "Product Category": {
        select: {
          options: [
            { name: "Food", color: "green" },
            { name: "Cosmetics", color: "pink" },
            { name: "Electronics", color: "blue" },
            { name: "Apparel / Textile", color: "purple" },
            { name: "Toys / Children's products", color: "yellow" },
            { name: "Other consumer goods", color: "gray" },
          ]
        }
      },
      "Trade Route": { rich_text: {} },
      "Product": { rich_text: {} },
      "Status": {
        select: {
          options: [
            { name: "New", color: "blue" },
            { name: "Contacted", color: "yellow" },
            { name: "Qualified", color: "green" },
            { name: "Closed", color: "gray" },
          ]
        }
      },
      "Session": { rich_text: {} },
      "Date": { date: {} },
    }
  });
  console.log("[Notion] Created Agent Consultation Requests database");
  return data.id;
}

// ─── Initialize: find or create all databases ───

export async function initNotion(): Promise<void> {
  if (g.__notionDbIds.initialized) {
    console.log("[Notion] Already initialized, skipping");
    return;
  }

  const pageId = process.env.NOTION_PAGE_ID;
  if (!pageId || !process.env.NOTION_API_KEY) {
    console.log("[Notion] No credentials, skipping initialization");
    return;
  }

  try {
    g.__notionDbIds.feedback = await findDatabase("Product Feedback") || await createFeedbackDb(pageId);
    g.__notionDbIds.backlog = await findDatabase("Product Backlog") || await createBacklogDb(pageId);
    g.__notionDbIds.events = await findDatabase("Analytics Events") || await createEventsDb(pageId);
    g.__notionDbIds.leads = await findDatabase("Agent Consultation Requests") || await createLeadsDb(pageId);

    // Idempotent schema upgrade: ensure the "Rating" property exists on the
    // Feedback DB for users whose DB predates the rating field. Notion accepts
    // a PATCH /databases/:id with the same property definition as a no-op.
    if (g.__notionDbIds.feedback) {
      await notionFetch(`/databases/${g.__notionDbIds.feedback}`, "PATCH", {
        properties: { "Rating": { number: { format: "number" } } },
      }).catch((e: any) => console.warn("[Notion] Rating column upgrade skipped:", e.message));
    }

    g.__notionDbIds.initialized = true;
    console.log("[Notion] All databases ready:", g.__notionDbIds);
  } catch (e: any) {
    console.error("[Notion] Init failed:", e.message);
  }
}

// ─── Log Feedback to Notion ───

// Client sends lowercase FeedbackReason codes ("incorrect", "too_vague", …) —
// map them to the Notion select option names defined in createFeedbackDb.
const REASON_LABEL: Record<string, string> = {
  incorrect:       "Incorrect",
  too_vague:       "Too vague",
  not_applicable:  "Not applicable",
  missing_context: "Missing context",
  helpful:         "Helpful",
};

export async function logFeedback(data: {
  itemName: string;
  isPositive: boolean;
  reason?: string;
  comment?: string;
  category?: string;
  tradeRoute?: string;
  sessionId?: string;
}): Promise<void> {
  const dbId = getFeedbackDbId();
  if (!dbId) { console.warn("[Notion] feedbackDbId not set, skipping logFeedback"); return; }

  const reasonName = data.reason ? (REASON_LABEL[data.reason] ?? data.reason) : undefined;

  try {
    await notionFetch("/pages", "POST", {
      parent: { database_id: dbId },
      properties: {
        "Item": { title: [{ text: { content: data.itemName } }] },
        "Feedback": { select: { name: data.isPositive ? "👍 Positive" : "👎 Negative" } },
        ...(reasonName ? { "Reason": { select: { name: reasonName } } } : {}),
        ...(data.comment ? { "Comment": { rich_text: [{ text: { content: data.comment } }] } } : {}),
        ...(data.category ? { "Product Category": { select: { name: data.category } } } : {}),
        ...(data.tradeRoute ? { "Trade Route": { rich_text: [{ text: { content: data.tradeRoute } }] } } : {}),
        ...(data.sessionId ? { "Session": { rich_text: [{ text: { content: data.sessionId } }] } } : {}),
        "Date": { date: { start: new Date().toISOString() } },
      }
    });
    console.log("[Notion] Feedback logged successfully");
  } catch (e: any) {
    console.error("[Notion] Failed to log feedback:", e.message);
  }
}

// ─── Log General Product Feedback ───

export async function logProductFeedback(data: {
  comment: string;
  rating?: number;
  category?: string;
  sessionId?: string;
}): Promise<void> {
  const dbId = getFeedbackDbId();
  if (!dbId) { console.warn("[Notion] feedbackDbId not set, skipping logProductFeedback"); return; }

  try {
    await notionFetch("/pages", "POST", {
      parent: { database_id: dbId },
      properties: {
        "Item": { title: [{ text: { content: data.rating ? `Rating: ${data.rating}/5` : "General Feedback" } }] },
        "Feedback": { select: { name: "💬 Comment" } },
        "Comment": { rich_text: [{ text: { content: (data.comment || "").slice(0, 2000) } }] },
        ...(typeof data.rating === "number" ? { "Rating": { number: data.rating } } : {}),
        ...(data.category ? { "Product Category": { select: { name: data.category } } } : {}),
        ...(data.sessionId ? { "Session": { rich_text: [{ text: { content: data.sessionId } }] } } : {}),
        "Date": { date: { start: new Date().toISOString() } },
      }
    });
    console.log("[Notion] Product feedback logged successfully");
  } catch (e: any) {
    console.error("[Notion] Failed to log product feedback:", e.message);
  }
}

// ─── Log Analytics Event ───

export async function logEvent(data: {
  event: string;
  sessionId: string;
  properties: Record<string, any>;
}): Promise<void> {
  const dbId = getEventsDbId();
  if (!dbId) { console.warn("[Notion] eventsDbId not set, skipping logEvent"); return; }

  try {
    await notionFetch("/pages", "POST", {
      parent: { database_id: dbId },
      properties: {
        "Event": { title: [{ text: { content: data.event } }] },
        "Session": { rich_text: [{ text: { content: data.sessionId } }] },
        "Properties": { rich_text: [{ text: { content: JSON.stringify(data.properties).slice(0, 2000) } }] },
        "Date": { date: { start: new Date().toISOString() } },
      }
    });
  } catch (e: any) {
    console.error("[Notion] Failed to log event:", e.message);
  }
}

// ─── Log Agent Consultation Request (lead capture) ───
// Called when a user submits the "Speak with an agent for free" form after
// reading their compliance report. These are warm leads — the user has just
// seen the full plan and is ready for human help.
export async function logLead(data: {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  question?: string;
  productCategory?: string;
  tradeRoute?: string;
  productName?: string;
  sessionId?: string;
}): Promise<void> {
  const dbId = getLeadsDbId();
  if (!dbId) { console.warn("[Notion] leadsDbId not set, skipping logLead"); return; }

  try {
    await notionFetch("/pages", "POST", {
      parent: { database_id: dbId },
      properties: {
        "Name":              { title: [{ text: { content: data.name } }] },
        "Email":             { email: data.email },
        "Status":            { select: { name: "New" } },
        "Date":              { date: { start: new Date().toISOString() } },
        ...(data.phone           ? { "Phone": { phone_number: data.phone } } : {}),
        ...(data.company         ? { "Company": { rich_text: [{ text: { content: data.company } }] } } : {}),
        ...(data.question        ? { "Question": { rich_text: [{ text: { content: data.question.slice(0, 2000) } }] } } : {}),
        ...(data.productCategory ? { "Product Category": { select: { name: data.productCategory } } } : {}),
        ...(data.tradeRoute      ? { "Trade Route": { rich_text: [{ text: { content: data.tradeRoute } }] } } : {}),
        ...(data.productName     ? { "Product": { rich_text: [{ text: { content: data.productName } }] } } : {}),
        ...(data.sessionId       ? { "Session": { rich_text: [{ text: { content: data.sessionId } }] } } : {}),
      }
    });
    console.log(`[Notion] Lead logged: ${data.name} (${data.email})`);
  } catch (e: any) {
    console.error("[Notion] Failed to log lead:", e.message);
    throw e; // bubble up — lead loss is bad, the API endpoint should know
  }
}

// ─── Log Chat Question ───
// Captures every user chat message as a structured "chat_question" event so
// the aggregator can mine recurring questions for content-gap signals.
// Recurring chat questions about the same topic = real product signal that
// thumbs-up/down feedback alone won't surface.
export async function logChatQuestion(data: {
  message: string;
  sessionId: string;
  productCategory?: string;
  tradeRoute?: string;
}): Promise<void> {
  return logEvent({
    event: "chat_question",
    sessionId: data.sessionId,
    properties: {
      message: data.message.slice(0, 500),
      productCategory: data.productCategory,
      tradeRoute: data.tradeRoute,
    },
  });
}

// ─── Smart Aggregate: Feedback → AI Triage → Backlog Items ───
//
// Think like a good PM:
// 1. Collect signals (feedback, events, chat patterns)
// 2. Look for PATTERNS not one-offs (min threshold before acting)
// 3. Use AI to triage: Is this actionable? Is it a real problem or user error?
// 4. Classify: prompt fix vs UX fix vs new feature vs noise
// 5. Only create backlog items for validated, high-signal patterns
//

interface FeedbackPattern {
  itemName: string;
  count: number;
  reasons: Record<string, number>;
  categories: Record<string, number>;
  routes: Record<string, number>;
  sessions: number; // unique sessions — more sessions = more real
}

async function aiTriage(patterns: FeedbackPattern[]): Promise<{
  actionable: Array<{
    itemName: string;
    verdict: "build" | "improve_prompt" | "monitor" | "ignore";
    taskTitle: string;
    priority: string;
    category: string;
    reasoning: string;
    evidence: string;
  }>;
}> {
  // Use Gemini to make smart PM decisions about what to build
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[Notion] No GEMINI_API_KEY, falling back to rule-based triage");
    return { actionable: fallbackTriage(patterns) };
  }

  const prompt = `You are TradeSetu's autonomous product manager. Analyze these user feedback patterns and decide what to act on.

FEEDBACK PATTERNS:
${JSON.stringify(patterns, null, 2)}

TRIAGE RULES (think like a great PM):
1. "incorrect" feedback on compliance items → likely a prompt/AI quality issue. Fix the system instruction, not the UI.
2. "too_vague" feedback → the AI is not giving enough detail. Improve the prompt to be more specific for that product category.
3. "not_applicable" feedback → the AI is hallucinating requirements. This is serious — fix the prompt to be more conservative.
4. "missing_context" → content gap. The AI doesn't know enough about this regulation area.
5. One-off complaints (1 session) → MONITOR, don't build. Could be user error.
6. Same item from 3+ unique sessions → real signal, worth acting on.
7. Feature requests in general feedback → evaluate if it fits the 20-30% automatable tier. If it requires human expertise, IGNORE.
8. Positive feedback on items → DON'T touch those items. They work.

VERDICTS:
- "build": Create a backlog task. Clear problem, clear fix, high impact.
- "improve_prompt": The fix is in the AI system instruction, not code. Update prompt engineering.
- "monitor": Not enough signal yet. Note it but don't act.
- "ignore": Noise, edge case, or user error. Don't waste cycles.

For each pattern, return your verdict with reasoning. Be ruthlessly honest — most feedback should NOT result in a build task.

Return JSON: { "actionable": [{ "itemName", "verdict", "taskTitle", "priority" (P0-P3), "category" (AI Quality/Content Gap/UX Improvement/New Feature/Bug Fix), "reasoning" (1-2 sentences why), "evidence" (data summary) }] }`;

  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
    });

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("No AI response");

    return JSON.parse(text);
  } catch (e: any) {
    console.error("[Notion] AI triage failed, using fallback:", e.message);
    return { actionable: fallbackTriage(patterns) };
  }
}

function fallbackTriage(patterns: FeedbackPattern[]) {
  // Rule-based fallback if AI is unavailable
  return patterns
    .filter(p => p.count >= 2 && p.sessions >= 2)
    .map(p => {
      const topReason = Object.entries(p.reasons).sort((a, b) => b[1] - a[1])[0];
      const isPromptFix = ["incorrect", "not_applicable"].includes(topReason?.[0] || "");
      return {
        itemName: p.itemName,
        verdict: (isPromptFix ? "improve_prompt" : "build") as "build" | "improve_prompt",
        taskTitle: `${isPromptFix ? "Prompt fix" : "Fix"}: "${p.itemName}" — ${topReason?.[0]} (${p.count}x)`,
        priority: p.count >= 10 ? "P0 - Critical" : p.count >= 5 ? "P1 - High" : p.count >= 3 ? "P2 - Medium" : "P3 - Low",
        category: isPromptFix ? "AI Quality" : "UX Improvement",
        reasoning: `${p.count} reports from ${p.sessions} sessions. Top reason: ${topReason?.[0]}.`,
        evidence: `Reasons: ${Object.entries(p.reasons).map(([r, c]) => `${r}: ${c}`).join(", ")}`,
      };
    });
}

// Pull recent chat_question events from the Events DB and cluster them.
// We don't run topic modelling — we just hand the raw questions to the AI
// triage which is plenty smart enough to spot recurring themes.
async function mineChatQuestionPatterns(): Promise<FeedbackPattern[]> {
  const eventsDbId = getEventsDbId();
  if (!eventsDbId) return [];

  try {
    const data = await notionFetch(`/databases/${eventsDbId}/query`, "POST", {
      page_size: 100,
      filter: { property: "Event", title: { equals: "chat_question" } },
    });

    type RawQ = { message: string; category: string; session: string };
    const rawQuestions: RawQ[] = [];
    for (const page of data.results || []) {
      const propsJson = page.properties?.["Properties"]?.rich_text?.[0]?.plain_text || "{}";
      let parsed: any = {};
      try { parsed = JSON.parse(propsJson); } catch {}
      const session = page.properties?.["Session"]?.rich_text?.[0]?.plain_text || "unknown";
      if (parsed.message) {
        rawQuestions.push({
          message: parsed.message,
          category: parsed.productCategory || "Unknown",
          session,
        });
      }
    }

    if (rawQuestions.length < 3) return []; // not enough signal

    // Build ONE big pattern with all questions — AI triage reads them and
    // decides which ones cluster into actionable themes.
    const sessions = new Set(rawQuestions.map(q => q.session));
    const categories: Record<string, number> = {};
    for (const q of rawQuestions) {
      categories[q.category] = (categories[q.category] || 0) + 1;
    }

    return [{
      itemName: `Chat Questions (${rawQuestions.length} recent)`,
      count: rawQuestions.length,
      reasons: { chat_cluster: rawQuestions.length },
      categories,
      routes: {},
      sessions: sessions.size,
      // Stash raw questions on the pattern so AI triage prompt can read them
      ...(rawQuestions.length > 0 ? { _rawQuestions: rawQuestions.slice(0, 30).map(q => q.message) } : {}),
    } as any];
  } catch (e: any) {
    console.error("[Notion] Failed to mine chat questions:", e.message);
    return [];
  }
}

// ─── Auto-aggregation trigger ─────────────────────────────────────
// Called on every feedback submission. Runs the aggregator in the background
// when enough new signal has accumulated, but never more than once per
// COOLDOWN_MS (so a burst of feedback doesn't hammer the Gemini API).
let lastAggregateAt = 0;
let pendingAggregate = false;
const COOLDOWN_MS = 60_000;     // at most once per minute
const MIN_FEEDBACKS = 3;        // need at least N new feedbacks to bother
let feedbacksSinceLastRun = 0;

export function notifyFeedbackForAutoAggregate() {
  feedbacksSinceLastRun++;

  const now = Date.now();
  const cooldownOK = (now - lastAggregateAt) >= COOLDOWN_MS;
  const enoughSignal = feedbacksSinceLastRun >= MIN_FEEDBACKS;

  if (!pendingAggregate && cooldownOK && enoughSignal) {
    pendingAggregate = true;
    feedbacksSinceLastRun = 0;
    lastAggregateAt = now;
    // Fire-and-forget — never blocks the user's feedback request
    aggregateFeedbackToBacklog()
      .then(r => console.log(`[Notion] Auto-aggregate ran:`, r))
      .catch(e => console.error(`[Notion] Auto-aggregate failed:`, e?.message))
      .finally(() => { pendingAggregate = false; });
  }
}

export async function aggregateFeedbackToBacklog(): Promise<{ created: number; updated: number; monitored: number; ignored: number }> {
  const fbDbId = getFeedbackDbId();
  const blDbId = getBacklogDbId();
  if (!fbDbId || !blDbId) return { created: 0, updated: 0, monitored: 0, ignored: 0 };

  try {
    // 1. Query ALL feedback (positive + negative) for full picture
    const feedbackData = await notionFetch(`/databases/${fbDbId}/query`, "POST", { page_size: 100 });

    // 2. Build patterns with richer signals
    const patterns: Record<string, FeedbackPattern> = {};
    const positiveItems = new Set<string>();

    for (const page of feedbackData.results || []) {
      const itemName = page.properties?.["Item"]?.title?.[0]?.plain_text || "Unknown";
      const feedback = page.properties?.["Feedback"]?.select?.name || "";
      const reason = page.properties?.["Reason"]?.select?.name || "Unknown";
      const category = page.properties?.["Product Category"]?.select?.name || "Unknown";
      const route = page.properties?.["Trade Route"]?.rich_text?.[0]?.plain_text || "Unknown";
      const session = page.properties?.["Session"]?.rich_text?.[0]?.plain_text || "unknown";

      // Track positive items — we should NOT touch these
      if (feedback.includes("Positive")) {
        positiveItems.add(itemName);
        continue;
      }

      if (!feedback.includes("Negative") && !feedback.includes("Comment")) continue;

      if (!patterns[itemName]) {
        patterns[itemName] = { itemName, count: 0, reasons: {}, categories: {}, routes: {}, sessions: 0 };
      }
      const p = patterns[itemName];
      p.count++;
      p.reasons[reason] = (p.reasons[reason] || 0) + 1;
      p.categories[category] = (p.categories[category] || 0) + 1;
      p.routes[route] = (p.routes[route] || 0) + 1;
      // Approximate unique sessions
      if (!(`_sessions` in p)) (p as any)._sessions = new Set();
      (p as any)._sessions.add(session);
      p.sessions = (p as any)._sessions.size;
    }

    // 3. Filter out items that also have positive feedback (net positive = leave alone)
    const signalPatterns = Object.values(patterns).filter(p => !positiveItems.has(p.itemName));

    // 3a. Mine chat questions from the events DB for content-gap signals.
    // The AI triage prompt already understands "Chat Question Cluster" as a
    // distinct source — feed clusters of recent chat questions in as patterns.
    const chatPatterns = await mineChatQuestionPatterns();
    const allPatterns = [...signalPatterns, ...chatPatterns];

    if (allPatterns.length === 0) {
      console.log("[Notion] No actionable patterns found");
      return { created: 0, updated: 0, monitored: 0, ignored: 0 };
    }

    // 4. AI triage — let the PM brain decide what's worth building
    const triaged = await aiTriage(allPatterns);

    // 5. Query existing backlog to avoid duplicates
    const backlogData = await notionFetch(`/databases/${blDbId}/query`, "POST", { page_size: 100 });
    const existingTasks: Record<string, string> = {};
    for (const page of backlogData.results || []) {
      const title = page.properties?.["Task"]?.title?.[0]?.plain_text || "";
      existingTasks[title] = page.id;
    }

    let created = 0, updated = 0, monitored = 0, ignored = 0;

    for (const item of triaged.actionable) {
      if (item.verdict === "ignore") { ignored++; continue; }
      if (item.verdict === "monitor") { monitored++; continue; }

      // Only "build" and "improve_prompt" verdicts create/update backlog items
      const existingId = Object.entries(existingTasks).find(([t]) => t.includes(item.itemName))?.[1];
      const sourceSignal = item.verdict === "improve_prompt" ? "N/A Pattern" : "Negative Feedback";

      if (existingId) {
        await notionFetch(`/pages/${existingId}`, "PATCH", {
          properties: {
            "Task": { title: [{ text: { content: item.taskTitle } }] },
            "Priority": { select: { name: item.priority } },
            "Feedback Count": { number: patterns[item.itemName]?.count || 0 },
            "Evidence": { rich_text: [{ text: { content: `${item.reasoning}\n\n${item.evidence}` } }] },
          }
        });
        updated++;
      } else {
        await notionFetch("/pages", "POST", {
          parent: { database_id: blDbId },
          properties: {
            "Task": { title: [{ text: { content: item.taskTitle } }] },
            "Priority": { select: { name: item.priority } },
            "Category": { select: { name: item.category } },
            "Status": { select: { name: "Backlog" } },
            "Evidence": { rich_text: [{ text: { content: `${item.reasoning}\n\n${item.evidence}` } }] },
            "Feedback Count": { number: patterns[item.itemName]?.count || 0 },
            "Affected Items": { rich_text: [{ text: { content: item.itemName } }] },
            "Source Signal": { select: { name: sourceSignal } },
            "Created": { date: { start: new Date().toISOString() } },
          }
        });
        created++;
      }
    }

    console.log(`[Notion] Smart triage: ${created} created, ${updated} updated, ${monitored} monitoring, ${ignored} ignored`);
    return { created, updated, monitored, ignored };
  } catch (e: any) {
    console.error("[Notion] Aggregation failed:", e.message);
    return { created: 0, updated: 0, monitored: 0, ignored: 0 };
  }
}
