import { createServerFn } from "@tanstack/react-start";

export const transcribeAudio = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as FormData)
  .handler(async ({ data }) => {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error("GROQ_API_KEY not configured");

    const file = data.get("file");
    if (!(file instanceof File) && !(file instanceof Blob)) {
      throw new Error("No audio file provided");
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
