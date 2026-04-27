// ─── Voice Service ───
// Records mic audio via MediaRecorder, posts to /api/sarvam/asr,
// returns the transcript. Uses webm/opus which Chrome/Safari/Firefox all support.
//
// This is wired into the form for "speak your product description" — even
// though it's optional for the demo, it shows the multilingual story end-to-end.

export interface VoiceTranscript {
  transcript: string;
  languageCode: string;
}

export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private mimeType: string = "audio/webm";

  async start(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone access not supported in this browser");
    }

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Pick best supported codec
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
    this.mimeType = candidates.find(t => MediaRecorder.isTypeSupported(t)) || "audio/webm";

    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: this.mimeType });
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start();
  }

  // Stops recording and returns a Promise that resolves with the transcript
  async stopAndTranscribe(languageHint?: string): Promise<VoiceTranscript> {
    if (!this.mediaRecorder) throw new Error("Recorder not started");

    return new Promise((resolve, reject) => {
      this.mediaRecorder!.onstop = async () => {
        try {
          const blob = new Blob(this.chunks, { type: this.mimeType });
          this.cleanup();

          const audioBase64 = await blobToBase64(blob);
          const res = await fetch("/api/sarvam/asr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              audioBase64,
              mimeType: this.mimeType,
              languageCode: languageHint || "unknown",
            }),
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `ASR failed: ${res.status}`);
          }

          const data = await res.json();
          resolve({
            transcript: data.transcript || "",
            languageCode: data.languageCode || "unknown",
          });
        } catch (e) {
          reject(e);
        }
      };

      this.mediaRecorder!.stop();
    });
  }

  cancel(): void {
    if (this.mediaRecorder?.state === "recording") {
      this.mediaRecorder.stop();
    }
    this.cleanup();
  }

  private cleanup(): void {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.mediaRecorder = null;
    this.chunks = [];
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // strip "data:audio/webm;base64," prefix
      const base64 = result.split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
