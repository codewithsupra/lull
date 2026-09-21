import { NextResponse, type NextRequest } from "next/server";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import { openrouter, CHAT_MODEL, parseJsonReply } from "@/lib/ai/openrouter";
import { Extraction } from "@/lib/care-plan";
import { PRIVATE_ROUTING, requireUser, withinLimit } from "@/lib/care-plan-server";
import { redactDeep } from "@/lib/redact";
import { logError, logEvent } from "@/lib/log";
import { requireFeature } from "@/lib/billing-server";

export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"]);

const SYSTEM = `You read medical prescriptions (printed or handwritten) and extract ONLY the medication regimen as strict JSON:
{"readable": boolean, "medications": [{"name": string, "dose": string, "frequency": string, "times": ["HH:MM"], "instructions": string, "as_needed": boolean}], "diagnosis_hint": string | null}
Rules:
- PRIVACY: never output any personal details: no patient or doctor names, ages, sex, dates of birth, addresses, phone numbers, emails, hospital/clinic names, registration or ID numbers, dates. Output medication facts only.
- Copy medication names and doses exactly as written (generic or brand). Do not correct, substitute or infer drugs that are not clearly written. If a name is illegible, omit it.
- Indian notation like 1-0-1 means morning-afternoon-night. Map frequency to suggested 24h times: morning 08:00, afternoon 14:00, night 21:30; "before bed/HS" 22:00; "OD" one morning dose; "BD" 08:00 and 20:00; "TDS" 08:00, 14:00, 20:00. SOS/PRN/as needed → as_needed true and times [].
- instructions: short, e.g. "after food", "for 30 days". Never add advice of your own.
- diagnosis_hint: a short generic condition label if clearly written (e.g. "anxiety", "insomnia"), else null.
- If this is not a prescription or is unreadable, return {"readable": false, "medications": [], "diagnosis_hint": null}.`;

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { insforge, userId } = auth;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Attach a photo or PDF of your prescription." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That file is over 8 MB. Try a smaller photo." }, { status: 413 });
  if (!TYPES.has(file.type)) return NextResponse.json({ error: "Use a JPG, PNG, WEBP, HEIC photo or a PDF." }, { status: 415 });

  const gate = await requireFeature(insforge, "scan");
  if ("error" in gate) return gate.error;
  if (!(await withinLimit(insforge, "extract", gate.limit))) {
    return NextResponse.json({ error: "You've scanned a lot today. Add medicines manually, or try again tomorrow." }, { status: 429 });
  }

  // The file lives only in this request's memory: never written to disk, storage or logs.
  const dataUrl = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
  const attachment =
    file.type === "application/pdf"
      ? { type: "file", file: { filename: "prescription.pdf", file_data: dataUrl } }
      : { type: "image_url", image_url: { url: dataUrl } };

  try {
    const completion = await openrouter.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0,
      max_completion_tokens: 1500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: [{ type: "text", text: "Extract the medication regimen from this prescription." }, attachment] },
      ],
      ...PRIVATE_ROUTING,
    } as unknown as ChatCompletionCreateParamsNonStreaming);

    const parsed = Extraction.parse(parseJsonReply(completion.choices[0]?.message?.content ?? ""));
    const clean = redactDeep(parsed);
    clean.medications = clean.medications
      .filter((m) => m.name.trim() && !m.name.includes("["))
      .map((m) => ({ ...m, times: m.times.filter((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)) }));
    logEvent("intake.extract", { user: userId, meds: clean.medications.length, readable: clean.readable });
    return NextResponse.json(clean);
  } catch (err) {
    logError("intake.extract.failed", err, { user: userId });
    return NextResponse.json({ error: "We couldn't read that one. Try a sharper, well-lit photo, or add medicines manually." }, { status: 502 });
  }
}
