/**
 * Defence-in-depth PII scrubber. The extraction prompt already forbids personal details;
 * this removes anything that slips through before text reaches the client or database.
 */

type Replacer = string | ((match: string) => string);

const RULES: [RegExp, Replacer][] = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]"],
  // phone numbers: +91 98xxxxxx, (555) 123-4567, 555 123 4567 ...
  [/(?:\+?\d{1,3}[ -]?)?(?:\(\d{2,4}\)[ -]?)?\d{3,5}[ -]?\d{3,4}[ -]?\d{0,4}(?=\D|$)/g, (m) => (m.replace(/\D/g, "").length >= 8 ? "[phone]" : m)],
  // dates like 12/03/1990, 1990-03-12, 12.03.90
  [/\b\d{1,4}[/.-]\d{1,2}[/.-]\d{2,4}\b/g, "[date]"],
  // long identifier-like digit runs (MRN, Aadhaar, SSN, registration no.)
  [/\b(?:\d[ -]?){9,}\b/g, "[id]"],
  // labelled personal fields: "Patient: Jane Doe", "Name - John", "Dr. Smith", "Age/Sex: 34/M"
  [/\b(?:patient(?:'s)?\s*name|patient|name|pt|mr\.?|mrs\.?|ms\.?|dob|date of birth|address|addr|age\s*\/?\s*sex|reg(?:istration)?\.?\s*no\.?|uhid|mrn|ssn|aadhaar)\s*[:\-–]\s*[^\n,;]*/gi, "[redacted]"],
  [/\b[Dd][Rr]\.?[ \t]+[A-Z][\w.'-]*(?:[ \t]+[A-Z][\w.'-]*){0,3}/g, "[doctor]"],
];

export function redact(text: string): string {
  let out = text;
  for (const [re, rep] of RULES) {
    out = typeof rep === "function" ? out.replace(re, rep) : out.replace(re, rep);
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

/** Recursively redacts every string inside a JSON-like value. */
export function redactDeep<T>(value: T): T {
  if (typeof value === "string") return redact(value) as T;
  if (Array.isArray(value)) return value.map(redactDeep) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactDeep(v)])) as T;
  }
  return value;
}
