import { createServerFn } from "@tanstack/react-start";

// Groq Whisper accepts audio up to 25 MB; reject anything larger (or missing)
// before spending an upstream transcription call.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export const transcribeAudio = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    if (!(d instanceof FormData)) throw new Error("Invalid form data");
    return d;
  })
  .handler(async ({ data }) => {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error("GROQ_API_KEY not configured");

    const file = data.get("file") as unknown as Blob | null;
    if (!file || typeof (file as Blob).arrayBuffer !== "function") {
      throw new Error("No audio file provided");
    }
    if ((file as Blob).size > MAX_AUDIO_BYTES) {
      throw new Error("Audio file too large");
    }

    const forwarded = new FormData();
    forwarded.append("file", file, "audio.webm");
    forwarded.append("model", "whisper-large-v3");

    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: forwarded,
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Whisper error ${res.status}: ${t}`);
    }
    const json = await res.json();
    return { text: (json.text ?? "").toString().trim() };
  });
