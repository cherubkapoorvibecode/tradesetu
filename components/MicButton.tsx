// ─── MicButton ───
// Click → record → click again to stop → ASR transcript inserted into target field.
// Auto-detects language; sends languageHint when user has selected a language.

import React, { useRef, useState } from "react";
import { VoiceRecorder } from "../services/voiceService";
import type { LanguagePreference } from "../types";

interface MicButtonProps {
  onTranscript: (text: string, languageCode: string) => void;
  languagePref: LanguagePreference;
  size?: "sm" | "md";
  className?: string;
  title?: string;
}

const MicButton: React.FC<MicButtonProps> = ({ onTranscript, languagePref, size = "md", className = "", title }) => {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<VoiceRecorder | null>(null);

  const handleClick = async () => {
    if (busy) return;
    setError(null);

    if (!recording) {
      // Start
      try {
        const r = new VoiceRecorder();
        await r.start();
        recorderRef.current = r;
        setRecording(true);
      } catch (e: any) {
        setError(e?.message || "Microphone access denied");
      }
    } else {
      // Stop + transcribe
      const r = recorderRef.current;
      if (!r) return;
      setBusy(true);
      setRecording(false);
      try {
        const langHint = languagePref || undefined;
        const result = await r.stopAndTranscribe(langHint);
        onTranscript(result.transcript, result.languageCode);
      } catch (e: any) {
        setError(e?.message || "Transcription failed");
      } finally {
        recorderRef.current = null;
        setBusy(false);
      }
    }
  };

  const sizes = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        title={title || (recording ? "Stop recording" : "Speak in your language")}
        className={`${sizes[size]} rounded-full flex items-center justify-center transition-all ${
          recording
            ? "bg-rose-500 text-white shadow-lg shadow-rose-500/30 animate-pulse ring-4 ring-rose-200"
            : busy
              ? "bg-slate-100 text-slate-400 cursor-wait"
              : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600"
        } ${className}`}
      >
        {busy ? (
          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0m7 7v4m-4 0h8m-4-7a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z" /></svg>
        )}
      </button>
      {error && (
        <div className="absolute top-full mt-1 right-0 text-[10px] text-rose-600 whitespace-nowrap bg-white px-2 py-1 rounded shadow-sm border border-rose-100 z-10">
          {error}
        </div>
      )}
    </div>
  );
};

export default MicButton;
