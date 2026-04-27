// ─── Crew SSE Consumer ───
//
// Why fetch + ReadableStream instead of EventSource?
//   EventSource requires GET. Our /api/crew/run takes a POST body (CrewInput).
//   The fetch streaming pattern works in all evergreen browsers and gives us
//   the same line-buffered "data: ..." semantics with full control.

import type { CrewEvent, CrewInput } from "../types-crew";

export async function streamCrew(
  input: CrewInput,
  onEvent: (event: CrewEvent) => void,
): Promise<void> {
  const res = await fetch("/api/crew/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Crew stream failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE frames separated by double-newline
    const frames = buffer.split("\n\n");
    buffer = frames.pop() || ""; // keep partial frame

    for (const frame of frames) {
      const line = frame.trim();
      if (!line.startsWith("data:")) continue;

      const json = line.slice(5).trim();
      if (!json) continue;

      try {
        const event = JSON.parse(json) as CrewEvent;
        onEvent(event);
      } catch {
        /* ignore malformed frames */
      }
    }
  }
}
