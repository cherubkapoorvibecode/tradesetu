// ─── Crew SSE Handler ───
// POST /api/crew/run with CrewInput body.
// Returns text/event-stream — one JSON CrewEvent per "data:" frame.
// The frontend opens this with fetch + a streaming reader (not EventSource,
// because EventSource doesn't support POST bodies).

import type { IncomingMessage, ServerResponse } from "http";
import { runCrew } from "./agents/orchestrator";
import type { CrewEvent, CrewInput } from "../types-crew";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: any) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export async function handleCrewRunRequest(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  let input: CrewInput;
  try {
    const body = await readBody(req);
    input = JSON.parse(body);
  } catch (e: any) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  // Set up SSE response headers.
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no", // disable nginx buffering if behind proxy
  });

  // Helper to write one SSE frame.
  const send = (event: CrewEvent) => {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      /* client disconnected */
    }
  };

  try {
    await runCrew(input, send);
  } catch (e: any) {
    send({ type: "agent_error", agent: "classifier", error: e?.message || "Unknown crew error" });
  }

  res.end();
}
