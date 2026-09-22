/**
 * Crisis resources (FR3). Deliberately hardcoded and dependency-free so they work offline,
 * with no network, no database and no auth. Every country falls back to a global option.
 * Numbers are free/24-7 national services unless noted.
 */

export type CrisisLine = {
  name: string;
  /** Display number, dialled via tel: (digits only) or a url for web-only services. */
  number?: string;
  url?: string;
  note?: string;
  /** Text/SMS rather than a voice call. */
  text?: boolean;
};

export type CrisisRegion = {
  country: string;
  label: string;
  emergency: string;
  lines: CrisisLine[];
};

export const GLOBAL_LINE: CrisisLine = {
  name: "Find a helpline in your country",
  url: "https://findahelpline.com",
  note: "Free, confidential support in 130+ countries",
};

export const REGIONS: CrisisRegion[] = [
  {
    country: "IN",
    label: "India",
    emergency: "112",
    lines: [
      { name: "Tele-MANAS (Govt. of India)", number: "14416", note: "Free, 24/7, in 20+ languages" },
      { name: "KIRAN Mental Health Helpline", number: "1800 599 0019", note: "Free, 24/7" },
      { name: "iCall (TISS)", number: "91529 87821", note: "Counselling, Mon–Sat 10am–8pm" },
      { name: "AASRA", number: "98204 66726", note: "24/7 suicide prevention" },
    ],
  },
  {
    country: "US",
    label: "United States",
    emergency: "911",
    lines: [
      { name: "988 Suicide & Crisis Lifeline", number: "988", note: "Call or text, 24/7" },
      { name: "Crisis Text Line", number: "741741", text: true, note: "Text HOME" },
      { name: "Trevor Project (LGBTQ+ youth)", number: "1 866 488 7386", note: "24/7" },
    ],
  },
  {
    country: "GB",
    label: "United Kingdom",
    emergency: "999",
    lines: [
      { name: "Samaritans", number: "116 123", note: "Free, 24/7" },
      { name: "Shout", number: "85258", text: true, note: "Text SHOUT" },
      { name: "NHS 111 (option 2)", number: "111", note: "Urgent mental health support" },
    ],
  },
  {
    country: "IE",
    label: "Ireland",
    emergency: "112",
    lines: [
      { name: "Samaritans Ireland", number: "116 123", note: "Free, 24/7" },
      { name: "Text About It", number: "50808", text: true, note: "Text HELLO" },
    ],
  },
  {
    country: "CA",
    label: "Canada",
    emergency: "911",
    lines: [{ name: "9-8-8 Suicide Crisis Helpline", number: "988", note: "Call or text, 24/7, EN/FR" }],
  },
  {
    country: "AU",
    label: "Australia",
    emergency: "000",
    lines: [
      { name: "Lifeline", number: "13 11 14", note: "24/7" },
      { name: "Beyond Blue", number: "1300 22 4636", note: "24/7" },
    ],
  },
  {
    country: "NZ",
    label: "New Zealand",
    emergency: "111",
    lines: [{ name: "1737 Need to Talk?", number: "1737", note: "Call or text, 24/7" }],
  },
  {
    country: "SG",
    label: "Singapore",
    emergency: "995",
    lines: [{ name: "Samaritans of Singapore (SOS)", number: "1767", note: "24/7" }],
  },
  {
    country: "AE",
    label: "United Arab Emirates",
    emergency: "999",
    lines: [{ name: "Estijaba (Dept. of Health)", number: "800 1717", note: "24/7" }],
  },
  {
    country: "DE",
    label: "Germany",
    emergency: "112",
    lines: [{ name: "Telefonseelsorge", number: "0800 111 0 111", note: "Free, 24/7" }],
  },
  {
    country: "NL",
    label: "Netherlands",
    emergency: "112",
    lines: [{ name: "113 Zelfmoordpreventie", number: "0800 0113", note: "Free, 24/7" }],
  },
  {
    country: "ZA",
    label: "South Africa",
    emergency: "112",
    lines: [{ name: "SADAG Suicide Crisis Line", number: "0800 567 567", note: "24/7" }],
  },
];

const DEFAULT_REGION: CrisisRegion = {
  country: "XX",
  label: "your country",
  emergency: "your local emergency number",
  lines: [],
};

/** Resolves an ISO country code (from a geo header or a manual pick) to its resources. */
export function regionFor(country: string | null | undefined): CrisisRegion {
  const code = (country ?? "").trim().toUpperCase();
  return REGIONS.find((r) => r.country === code) ?? DEFAULT_REGION;
}

/** Everything to show in the crisis sheet: national lines first, always with a global fallback. */
export function crisisLinesFor(country: string | null | undefined): { region: CrisisRegion; lines: CrisisLine[] } {
  const region = regionFor(country);
  return { region, lines: [...region.lines, GLOBAL_LINE] };
}

/** tel:/sms:/https: href for a line. */
export function lineHref(line: CrisisLine): string {
  if (line.url) return line.url;
  const digits = (line.number ?? "").replace(/\D/g, "");
  if (!digits) return GLOBAL_LINE.url!;
  return line.text ? `sms:${digits}` : `tel:${digits}`;
}

export const COUNTRY_OPTIONS = REGIONS.map((r) => ({ code: r.country, label: r.label })).sort((a, b) => a.label.localeCompare(b.label));
